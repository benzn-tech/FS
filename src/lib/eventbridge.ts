import {
  EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge'

// ---------------------------------------------------------------------------
// EventBridge client singleton
// ---------------------------------------------------------------------------
const eventbridge = new EventBridgeClient({
  region: process.env.AWS_REGION ?? 'ap-southeast-2',
  credentials: process.env.APP_AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
})

const EVENT_BUS_NAME = process.env.EVENTBRIDGE_BUS_NAME ?? 'fieldsightai-events'
const EVENT_SOURCE = 'fieldsightai.api'

// ---------------------------------------------------------------------------
// Event detail types — one per pipeline event
// ---------------------------------------------------------------------------
export type EventDetailType =
  | 'realptt-video-uploaded'     // webhook received from RealPTT
  | 'retry-requested'            // user retried a FAILED session
  | 'export-requested'           // user triggered export to Aconex/Safebase
  | 'transcription-complete'     // Lambda signals transcript is ready (internal)

// ---------------------------------------------------------------------------
// Publish a single event to the FieldSightAI EventBridge bus.
// detail can be any JSON-serialisable object.
// ---------------------------------------------------------------------------
export async function publishEvent(
  detailType: EventDetailType,
  detail: Record<string, unknown>,
): Promise<void> {
  const entry: PutEventsRequestEntry = {
    EventBusName: EVENT_BUS_NAME,
    Source: EVENT_SOURCE,
    DetailType: detailType,
    Detail: JSON.stringify(detail),
    Time: new Date(),
  }

  const result = await eventbridge.send(new PutEventsCommand({ Entries: [entry] }))

  const failed = result.FailedEntryCount ?? 0
  if (failed > 0) {
    const errorEntry = result.Entries?.[0]
    throw new Error(
      `EventBridge publish failed: ${errorEntry?.ErrorCode} — ${errorEntry?.ErrorMessage}`,
    )
  }
}

// ---------------------------------------------------------------------------
// Publish multiple events in a single API call (max 10 per PutEvents call).
// ---------------------------------------------------------------------------
export async function publishEvents(
  events: Array<{ detailType: EventDetailType; detail: Record<string, unknown> }>,
): Promise<void> {
  const entries: PutEventsRequestEntry[] = events.map(({ detailType, detail }) => ({
    EventBusName: EVENT_BUS_NAME,
    Source: EVENT_SOURCE,
    DetailType: detailType,
    Detail: JSON.stringify(detail),
    Time: new Date(),
  }))

  const result = await eventbridge.send(new PutEventsCommand({ Entries: entries }))

  if ((result.FailedEntryCount ?? 0) > 0) {
    throw new Error(`EventBridge batch publish had ${result.FailedEntryCount} failure(s)`)
  }
}
