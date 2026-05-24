#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { FieldSightAIStack } from '../lib/fieldsightai-stack'

const app = new cdk.App()

new FieldSightAIStack(app, 'FieldSightAIStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-southeast-2',
  },
  description: 'FieldSightAI — S3 buckets, EventBridge, Lambda, SSM, SQS DLQs',
})
