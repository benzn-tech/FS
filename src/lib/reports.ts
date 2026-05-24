import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { query, queryOne } from '@/lib/db'

const BEDROCK_MODEL_ID = 'amazon.nova-pro-v1:0'

function makeBedrockClient() {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? 'ap-southeast-2',
    credentials: process.env.APP_AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY!,
        }
      : undefined,
  })
}

// Verify the caller has access to this project and return the project row.
// Returns null if the project doesn't exist or the caller lacks access.
export async function verifyProjectAccess(
  projectId: string,
  role: string,
  orgId: string | undefined,
  userId: string,
): Promise<{ id: string; org_id: string; name: string } | null> {
  const project = await queryOne<{ id: string; org_id: string; name: string }>(
    'SELECT id, org_id, name FROM projects WHERE id = $1',
    [projectId],
  )
  if (!project) return null

  if (role !== 'super_admin') {
    if (project.org_id !== orgId) return null
    if (role !== 'org_admin') {
      const membership = await queryOne(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, userId],
      )
      if (!membership) return null
    }
  }

  return project
}

// Fetch and format all transcript segments for a project on a given date.
// Returns formatted text and the raw rows.
export async function fetchDayTranscript(
  projectId: string,
  date: string,
): Promise<{ transcriptText: string; hasContent: boolean }> {
  const rows = await query<{
    session_title: string | null
    recorded_at: string
    speaker_label: string | null
    text: string
  }>(
    `SELECT s.title AS session_title, s.recorded_at,
            ts.speaker_label, COALESCE(ts.edited_text, ts.original_text) AS text
       FROM sessions s
       JOIN transcript_segments ts ON ts.session_id = s.id
      WHERE s.project_id = $1
        AND DATE(s.recorded_at AT TIME ZONE 'UTC') = $2::date
      ORDER BY s.recorded_at ASC, ts.segment_index ASC`,
    [projectId, date],
  )

  if (rows.length === 0) return { transcriptText: '', hasContent: false }

  let transcriptText = ''
  let currentSession = ''
  for (const row of rows) {
    const sessionLabel =
      row.session_title ??
      `Recording at ${new Date(row.recorded_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
    if (sessionLabel !== currentSession) {
      currentSession = sessionLabel
      transcriptText += `\n\n=== ${sessionLabel} ===\n`
    }
    const speaker = row.speaker_label ? `${row.speaker_label}: ` : ''
    transcriptText += `${speaker}${row.text}\n`
  }

  return { transcriptText, hasContent: true }
}

// Invoke Bedrock with a given prompt and return the text response.
export async function invokeBedrockText(prompt: string, maxTokens = 1024): Promise<string> {
  const bedrock = makeBedrockClient()
  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens },
      }),
    }),
  )
  const result = JSON.parse(new TextDecoder().decode(response.body))
  return (result.output?.message?.content as { text: string }[])
    .map((b) => b.text)
    .join('')
}

// Parse JSON from Bedrock response — strips markdown code fences if present.
export function parseBedrockJson<T>(raw: string): T {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(stripped) as T
}

// Fetch weather summary for a given lat/lng and date from Open-Meteo (free, no key).
// Returns a human-readable string or null on failure.
async function fetchWeatherSummary(
  latitude: number,
  longitude: number,
  date: string,
): Promise<string | null> {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode&timezone=auto`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json() as {
      daily?: {
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_sum: number[]
        windspeed_10m_max: number[]
        weathercode: number[]
      }
    }
    const d = data.daily
    if (!d) return null

    const wmoDescription: Record<number, string> = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Depositing rime fog',
      51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
      77: 'Snow grains', 80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
      85: 'Slight snow showers', 86: 'Heavy snow showers',
      95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
    }

    const code = d.weathercode[0]
    const condition = wmoDescription[code] ?? 'Variable conditions'
    const maxTemp = d.temperature_2m_max[0]?.toFixed(1)
    const minTemp = d.temperature_2m_min[0]?.toFixed(1)
    const rain = d.precipitation_sum[0]?.toFixed(1)
    const wind = d.windspeed_10m_max[0]?.toFixed(1)

    return `${condition}, ${minTemp}°C – ${maxTemp}°C, ${rain}mm rain, max wind ${wind} km/h`
  } catch {
    return null
  }
}

// Generate a daily site report for a project on a given date.
// Returns the report markdown string, or null if no transcripts exist.
export async function generateDailyReport(
  projectId: string,
  date: string,
  projectName: string,
  coords?: { latitude: number; longitude: number } | null,
): Promise<string | null> {
  const [{ transcriptText, hasContent }, weatherSummary] = await Promise.all([
    fetchDayTranscript(projectId, date),
    coords ? fetchWeatherSummary(coords.latitude, coords.longitude, date) : Promise.resolve(null),
  ])
  if (!hasContent) return null

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const weatherLine = weatherSummary
    ? `\nWeather on site: ${weatherSummary}`
    : ''

  const prompt = `You are a construction site documentation assistant. Based on the following transcripts from site recordings at "${projectName}" on ${formattedDate}, generate a professional daily site report.${weatherLine}

The report should include:
1. **Executive Summary** — 2-3 sentence overview of the day's key activities
2. **Weather** — conditions on site (use the weather data provided above if available)
3. **Work Completed** — bullet points of work completed on site
4. **Issues & Action Items** — any problems, defects, or follow-up actions mentioned
5. **Safety Observations** — any safety briefings, incidents, or compliance notes
6. **Next Steps** — any planned work or upcoming tasks mentioned

Be concise and professional. Use Australian English. Only include sections where there is relevant content from the transcripts. Do not invent details, names, or activities not mentioned in the transcripts.

TRANSCRIPTS:
${transcriptText}`

  return invokeBedrockText(prompt, 1200)
}
