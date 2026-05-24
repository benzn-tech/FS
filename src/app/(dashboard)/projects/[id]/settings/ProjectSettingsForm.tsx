'use client'

import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'

interface Props {
  projectId: string
  initialName: string
  initialAddress: string | null
  initialLatitude: number | null
  initialLongitude: number | null
  canEdit: boolean
}

export function ProjectSettingsForm({
  projectId,
  initialName,
  initialAddress,
  initialLatitude,
  initialLongitude,
  canEdit,
}: Props) {
  const [name, setName] = useState(initialName)
  const [address, setAddress] = useState(initialAddress ?? '')
  const [latitude, setLatitude] = useState(initialLatitude != null ? String(initialLatitude) : '')
  const [longitude, setLongitude] = useState(initialLongitude != null ? String(initialLongitude) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const body: Record<string, unknown> = {}
    if (canEdit) {
      body.name = name.trim()
      body.address = address.trim() || null
      body.latitude = latitude.trim() !== '' ? parseFloat(latitude) : null
      body.longitude = longitude.trim() !== '' ? parseFloat(longitude) : null
    }

    if (Object.keys(body).length === 0) {
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {canEdit && (
        <>
          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full text-sm px-3 py-2 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Site Street, Suburb NSW 2000"
              className="w-full text-sm px-3 py-2 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
            />
            <p className="text-[11px] text-[#9CA3AF] mt-1">Used as map fallback when coordinates are not set.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">GPS Coordinates</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Latitude (e.g. -33.8688)"
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
              />
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Longitude (e.g. 151.2093)"
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#FFD966]"
              />
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-1">
              When set, the map will use exact coordinates instead of the address string.
            </p>
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !canEdit}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#FFD966] text-[#111827] rounded-lg hover:bg-[#FFC107] disabled:opacity-50 transition-colors"
        >
          {saving
            ? <Loader2 size={14} className="animate-spin" />
            : saved
              ? <Check size={14} className="text-green-600" />
              : null}
          {saved ? 'Saved!' : 'Save changes'}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!canEdit && (
          <p className="text-xs text-[#9CA3AF]">Only super admins can edit project details.</p>
        )}
      </div>
    </form>
  )
}
