import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as events from 'aws-cdk-lib/aws-events'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions'
import { Construct } from 'constructs'

// ---------------------------------------------------------------------------
// FieldSightAI CDK Stack
//
// Provisions:
//  - S3 buckets:   videos (private), transcripts (private), media (public-read)
//  - SQS DLQs:     one per Lambda (ingest, transcription, process, export-aconex, export-safebase)
//  - EventBridge:  custom bus + rules for the processing pipeline
//  - IAM roles:    least-privilege per Lambda function
//  - SSM params:   placeholder secrets (values filled manually in AWS console)
// ---------------------------------------------------------------------------
export class FieldSightAIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // -----------------------------------------------------------------------
    // S3 Buckets
    // -----------------------------------------------------------------------

    // Raw video files uploaded from RealPTT — private
    const videosBucket = new s3.Bucket(this, 'VideosBucket', {
      bucketName: 'fsai-videos',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      lifecycleRules: [
        {
          // Transition raw videos to cheaper storage after 90 days
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // Amazon Transcribe output — private
    const transcriptsBucket = new s3.Bucket(this, 'TranscriptsBucket', {
      bucketName: 'fsai-transcripts',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // CMS media assets (landing page images, logos) — public-read
    const mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: 'fsai-media',
      // Public read required so marketing pages can serve images directly
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      publicReadAccess: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['https://fieldsightai.com', 'http://localhost:3000'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // -----------------------------------------------------------------------
    // SQS Dead-Letter Queues (one per Lambda)
    // -----------------------------------------------------------------------

    const ingestDlq = new sqs.Queue(this, 'IngestVideoDlq', {
      queueName: 'fieldsightai-ingest-video-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    })

    const transcriptionDlq = new sqs.Queue(this, 'TriggerTranscriptionDlq', {
      queueName: 'fieldsightai-trigger-transcription-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    })

    const processTranscriptDlq = new sqs.Queue(this, 'ProcessTranscriptDlq', {
      queueName: 'fieldsightai-process-transcript-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    })

    const exportAconexDlq = new sqs.Queue(this, 'ExportAconexDlq', {
      queueName: 'fieldsightai-export-aconex-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    })

    const exportSafebaseDlq = new sqs.Queue(this, 'ExportSafebaseDlq', {
      queueName: 'fieldsightai-export-safebase-dlq',
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    })

    // -----------------------------------------------------------------------
    // EventBridge — Custom Bus
    // -----------------------------------------------------------------------

    const eventBus = new events.EventBus(this, 'FieldSightAIEventBus', {
      eventBusName: 'fieldsightai-events',
    })

    // Rule: RealPTT video uploaded → ingest_video Lambda
    // (Lambda ARN added manually once Lambda is deployed; target placeholder here)
    new events.Rule(this, 'RealPttVideoUploadedRule', {
      eventBus,
      ruleName: 'realptt-video-uploaded',
      description: 'Routes RealPTT webhook events to ingest_video Lambda',
      eventPattern: {
        source: ['fieldsightai.api'],
        detailType: ['realptt-video-uploaded'],
      },
      // Targets wired in Phase 13 once Lambda ARNs exist:
      // targets: [new targets.LambdaFunction(ingestLambda, { deadLetterQueue: ingestDlq, retryAttempts: 2 })]
    })

    // Rule: Retry requested → ingest_video Lambda (same target, different detail type)
    new events.Rule(this, 'RetryRequestedRule', {
      eventBus,
      ruleName: 'retry-requested',
      description: 'Re-triggers ingest_video Lambda when user clicks Retry on a FAILED session',
      eventPattern: {
        source: ['fieldsightai.api'],
        detailType: ['retry-requested'],
      },
    })

    // Rule: Scheduled poll — triggers ingest_video Lambda every 5 minutes to pull
    // new videos from RealPTT (RealPTT has no webhook — polling is required)
    new events.Rule(this, 'RealPttPollSchedule', {
      ruleName: 'realptt-poll-schedule',
      description: 'Triggers ingest_video Lambda every 5 minutes to poll RealPTT for new videos',
      schedule: events.Schedule.rate(cdk.Duration.minutes(2)),
      // Target wired after Lambda is deployed:
      // targets: [new targets.LambdaFunction(ingestLambda, { deadLetterQueue: ingestDlq, retryAttempts: 2 })]
    })

    // Rule: Amazon Transcribe job complete → process_transcript Lambda
    // This fires on the default EventBridge bus (Transcribe emits to default bus)
    new events.Rule(this, 'TranscribeJobCompleteRule', {
      // No eventBus = default bus
      ruleName: 'fieldsightai-transcribe-job-complete',
      description: 'Routes Transcribe job state changes to process_transcript Lambda',
      eventPattern: {
        source: ['aws.transcribe'],
        detailType: ['Transcribe Job State Change'],
        detail: {
          TranscriptionJobStatus: ['COMPLETED', 'FAILED'],
        },
      },
    })

    // -----------------------------------------------------------------------
    // IAM Roles — one per Lambda (least-privilege)
    // -----------------------------------------------------------------------

    // ingest_video: needs S3 put (videos), DB write, EventBridge publish, SSM read
    const ingestLambdaRole = new iam.Role(this, 'IngestVideoLambdaRole', {
      roleName: 'fieldsightai-ingest-video-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        IngestVideoPolicy: new iam.PolicyDocument({
          statements: [
            // Write raw video to S3
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:PutObject'],
              resources: [videosBucket.arnForObjects('*')],
            }),
            // Read secrets from SSM
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ssm:GetParameter', 'ssm:GetParameters'],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/fieldsightai/*`,
              ],
            }),
            // Publish events to EventBridge (for status updates)
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['events:PutEvents'],
              resources: [eventBus.eventBusArn],
            }),
            // Write to DLQ on failure
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sqs:SendMessage'],
              resources: [ingestDlq.queueArn],
            }),
          ],
        }),
      },
    })

    // trigger_transcription: needs S3 read (videos), Transcribe start job, DB write, SSM read
    const triggerTranscriptionLambdaRole = new iam.Role(this, 'TriggerTranscriptionLambdaRole', {
      roleName: 'fieldsightai-trigger-transcription-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        TriggerTranscriptionPolicy: new iam.PolicyDocument({
          statements: [
            // Read raw video from S3 (Transcribe needs access, but we pass the S3 URI)
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject'],
              resources: [videosBucket.arnForObjects('*')],
            }),
            // Transcribe output goes to transcripts bucket
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:PutObject'],
              resources: [transcriptsBucket.arnForObjects('*')],
            }),
            // Start Transcribe jobs
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['transcribe:StartTranscriptionJob'],
              resources: ['*'],
            }),
            // Read secrets from SSM
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ssm:GetParameter', 'ssm:GetParameters'],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/fieldsightai/*`,
              ],
            }),
            // Write to DLQ on failure
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sqs:SendMessage'],
              resources: [transcriptionDlq.queueArn],
            }),
          ],
        }),
      },
    })

    // process_transcript: needs S3 read (transcripts), DB write, SSM read
    const processTranscriptLambdaRole = new iam.Role(this, 'ProcessTranscriptLambdaRole', {
      roleName: 'fieldsightai-process-transcript-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        ProcessTranscriptPolicy: new iam.PolicyDocument({
          statements: [
            // Read transcript JSON from S3
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['s3:GetObject'],
              resources: [transcriptsBucket.arnForObjects('*')],
            }),
            // Read secrets from SSM
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ssm:GetParameter', 'ssm:GetParameters'],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/fieldsightai/*`,
              ],
            }),
            // Write to DLQ on failure
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sqs:SendMessage'],
              resources: [processTranscriptDlq.queueArn],
            }),
          ],
        }),
      },
    })

    // export_to_aconex: needs DB read, SSM read (Aconex API key)
    const exportAconexLambdaRole = new iam.Role(this, 'ExportAconexLambdaRole', {
      roleName: 'fieldsightai-export-aconex-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        ExportAconexPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ssm:GetParameter', 'ssm:GetParameters'],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/fieldsightai/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sqs:SendMessage'],
              resources: [exportAconexDlq.queueArn],
            }),
          ],
        }),
      },
    })

    // export_to_safebase: needs DB read, SSM read (Safebase API key)
    const exportSafebaseLambdaRole = new iam.Role(this, 'ExportSafebaseLambdaRole', {
      roleName: 'fieldsightai-export-safebase-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        ExportSafebasePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['ssm:GetParameter', 'ssm:GetParameters'],
              resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/fieldsightai/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['sqs:SendMessage'],
              resources: [exportSafebaseDlq.queueArn],
            }),
          ],
        }),
      },
    })

    // -----------------------------------------------------------------------
    // SSM Parameter Store — placeholder secrets
    // Values must be filled manually in AWS Console or via CLI before deploying Lambdas.
    // -----------------------------------------------------------------------

    // RealPTT uses session-based auth (not API key) — store account + password
    new ssm.StringParameter(this, 'RealPttAccount', {
      parameterName: '/fieldsightai/realptt_account',
      description: 'RealPTT company login account name',
      stringValue: 'REPLACE_ME',
      tier: ssm.ParameterTier.STANDARD,
    })

    new ssm.StringParameter(this, 'RealPttPassword', {
      parameterName: '/fieldsightai/realptt_password',
      description: 'RealPTT company login password (plain text — hashed at login time)',
      stringValue: 'REPLACE_ME',
      tier: ssm.ParameterTier.STANDARD,
    })

    new ssm.StringParameter(this, 'DbConnectionString', {
      parameterName: '/fieldsightai/db_connection_string',
      description: 'PostgreSQL connection string for Lambda functions (RDS)',
      stringValue: 'REPLACE_ME',
      tier: ssm.ParameterTier.STANDARD,
    })

    // -----------------------------------------------------------------------
    // Alerting — SNS topic + CloudWatch alarms
    //
    // ALERTS_EMAIL must be set as a CDK context value or environment variable:
    //   cdk deploy --context alertsEmail=ops@fieldsightai.com
    // -----------------------------------------------------------------------

    const alertsEmail = this.node.tryGetContext('alertsEmail') as string | undefined

    const alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: 'fieldsightai-alerts',
      displayName: 'FieldSightAI Operational Alerts',
    })

    if (alertsEmail) {
      alertsTopic.addSubscription(new snsSubscriptions.EmailSubscription(alertsEmail))
    }

    // Helper: alarm on DLQ receiving any messages (indicates Lambda failure)
    const dlqAlarm = (id: string, queue: sqs.Queue, label: string) =>
      new cloudwatch.Alarm(this, id, {
        alarmName: `fieldsightai-${label}-dlq-not-empty`,
        alarmDescription: `Messages landed in the ${label} DLQ — Lambda is failing`,
        metric: queue.metricApproximateNumberOfMessagesVisible({
          period: cdk.Duration.minutes(1),
          statistic: 'Maximum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })

    const alarms = [
      dlqAlarm('IngestDlqAlarm',          ingestDlq,           'ingest-video'),
      dlqAlarm('TranscriptionDlqAlarm',   transcriptionDlq,    'trigger-transcription'),
      dlqAlarm('ProcessTranscriptDlqAlarm', processTranscriptDlq, 'process-transcript'),
      dlqAlarm('ExportAconexDlqAlarm',    exportAconexDlq,     'export-aconex'),
      dlqAlarm('ExportSafebaseDlqAlarm',  exportSafebaseDlq,   'export-safebase'),
    ]

    // Wire every alarm to the SNS topic
    for (const alarm of alarms) {
      alarm.addAlarmAction(new cwActions.SnsAction(alertsTopic))
      alarm.addOkAction(new cwActions.SnsAction(alertsTopic))
    }

    // -----------------------------------------------------------------------
    // CloudFormation Outputs — useful for wiring Lambdas and the Next.js app
    // -----------------------------------------------------------------------

    new cdk.CfnOutput(this, 'VideosBucketName', {
      value: videosBucket.bucketName,
      description: 'S3 bucket for raw RealPTT video files',
      exportName: 'FieldSightAI-VideosBucket',
    })

    new cdk.CfnOutput(this, 'TranscriptsBucketName', {
      value: transcriptsBucket.bucketName,
      description: 'S3 bucket for Amazon Transcribe output',
      exportName: 'FieldSightAI-TranscriptsBucket',
    })

    new cdk.CfnOutput(this, 'MediaBucketName', {
      value: mediaBucket.bucketName,
      description: 'S3 bucket for public CMS media assets',
      exportName: 'FieldSightAI-MediaBucket',
    })

    new cdk.CfnOutput(this, 'EventBusArn', {
      value: eventBus.eventBusArn,
      description: 'Custom EventBridge bus ARN — set as EVENTBRIDGE_BUS_NAME in Next.js env',
      exportName: 'FieldSightAI-EventBusArn',
    })

    new cdk.CfnOutput(this, 'EventBusName', {
      value: eventBus.eventBusName,
      exportName: 'FieldSightAI-EventBusName',
    })

    new cdk.CfnOutput(this, 'IngestVideoRoleArn', {
      value: ingestLambdaRole.roleArn,
      exportName: 'FieldSightAI-IngestVideoRoleArn',
    })

    new cdk.CfnOutput(this, 'TriggerTranscriptionRoleArn', {
      value: triggerTranscriptionLambdaRole.roleArn,
      exportName: 'FieldSightAI-TriggerTranscriptionRoleArn',
    })

    new cdk.CfnOutput(this, 'ProcessTranscriptRoleArn', {
      value: processTranscriptLambdaRole.roleArn,
      exportName: 'FieldSightAI-ProcessTranscriptRoleArn',
    })

    new cdk.CfnOutput(this, 'ExportAconexRoleArn', {
      value: exportAconexLambdaRole.roleArn,
      exportName: 'FieldSightAI-ExportAconexRoleArn',
    })

    new cdk.CfnOutput(this, 'ExportSafebaseRoleArn', {
      value: exportSafebaseLambdaRole.roleArn,
      exportName: 'FieldSightAI-ExportSafebaseRoleArn',
    })
  }
}
