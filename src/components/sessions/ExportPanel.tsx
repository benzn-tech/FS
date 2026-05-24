'use client'

import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { type ExportLog } from '@/types'
import { CheckCircle, XCircle, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

const PLATFORM_OPTIONS = [
  { label: 'Aconex', value: 'aconex' },
  { label: 'Safebase', value: 'safebase' },
]

interface ExportPanelProps {
  sessionId: string
  exportHistory: ExportLog[]
  canExport: boolean
  isFinalized: boolean
}

export function ExportPanel({ sessionId, exportHistory, canExport, isFinalized }: ExportPanelProps) {
  const [platform, setPlatform] = useState('aconex')
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)

  async function handleExport() {
    setExporting(true)
    setResult(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      setResult(res.ok ? 'success' : 'error')
    } catch {
      setResult('error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold text-[#111827]">Export</h3>
        <p className="text-xs text-[#6B7280] mt-0.5">
          Push this session as a daily diary entry to your integration platform.
        </p>
      </div>

      {!isFinalized && (
        <p className="text-xs text-[#FF8F00] bg-[#FFFDE7] border border-[#FFD966]/40 rounded-lg px-3 py-2">
          Finalise the transcript before exporting.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Dropdown
          label="Platform"
          options={PLATFORM_OPTIONS}
          value={platform}
          onChange={setPlatform}
          disabled={!canExport || !isFinalized}
        />
        <Button
          onClick={handleExport}
          isLoading={exporting}
          disabled={!canExport || !isFinalized}
          className="gap-1.5 w-full justify-center"
        >
          <ArrowUpRight size={15} />
          Export to {PLATFORM_OPTIONS.find((p) => p.value === platform)?.label}
        </Button>
      </div>

      {result === 'success' && (
        <p className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle size={15} /> Exported successfully.
        </p>
      )}
      {result === 'error' && (
        <p className="flex items-center gap-2 text-sm text-[#EF4444] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <XCircle size={15} /> Export failed. Check your integration settings.
        </p>
      )}

      {/* Export history */}
      {exportHistory.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">History</p>
          <ul className="flex flex-col gap-1.5">
            {exportHistory.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between text-xs text-[#6B7280]"
              >
                <span className="capitalize">{log.platform}</span>
                <span>{new Date(log.exportedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                {log.status === 'success' ? (
                  <CheckCircle size={13} className="text-green-500" />
                ) : (
                  <XCircle size={13} className="text-[#EF4444]" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
