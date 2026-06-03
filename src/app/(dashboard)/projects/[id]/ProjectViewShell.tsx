'use client'

import { useState } from 'react'
import { ProjectDayView, type DayTab, type DaySession } from './ProjectDayView'
import { ProjectSidePanel } from './ProjectSidePanel'
import { TranscriptSearchButton } from './TranscriptSearch'
import { ReportButton } from './ReportButton'
import { HiddenRecordingsPanel } from './HiddenRecordingsPanel'

interface ProjectViewShellProps {
  projectId: string
  projectName: string
  days: DayTab[]
  initialDate: string
  initialSessions: DaySession[]
  address: string | null
  latitude?: number | null
  longitude?: number | null
  canEdit?: boolean
  isSuperAdmin?: boolean
}

export function ProjectViewShell({
  projectId,
  projectName,
  days,
  initialDate,
  initialSessions,
  address,
  latitude,
  longitude,
  canEdit = false,
  isSuperAdmin = false,
}: ProjectViewShellProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [sessions, setSessions] = useState<DaySession[]>(initialSessions)
  const [searchNav, setSearchNav] = useState<{
    date: string; sessionId: string; startSecs: number; nonce: number
  } | null>(null)

  const selectedDay = days.find((d) => d.date === selectedDate)
  const dayLabel = selectedDay?.label ?? selectedDate

  function handleDateChange(date: string, loadedSessions?: DaySession[]) {
    setSelectedDate(date)
    if (loadedSessions) setSessions(loadedSessions)
  }

  if (days.length === 0) {
    return <p className="text-sm text-[#6B7280] py-4">No recordings with transcripts yet.</p>
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Main content */}
      <div className="flex flex-col gap-4 flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[#6B7280]">
            {selectedDay ? `${selectedDay.count} recording${selectedDay.count !== 1 ? 's' : ''} on ${dayLabel}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <TranscriptSearchButton
              projectId={projectId}
              onNavigate={(date, sessionId, startSecs) => {
                setSelectedDate(date)
                setSearchNav({ date, sessionId, startSecs, nonce: Date.now() })
              }}
            />
            <ReportButton
              projectId={projectId}
              projectName={projectName}
              selectedDate={selectedDate}
              dayLabel={dayLabel}
            />
          </div>
        </div>

        {/* Day view */}
        <ProjectDayView
          projectId={projectId}
          days={days}
          initialDate={initialDate}
          initialSessions={initialSessions}
          canEdit={canEdit}
          onDateChange={(date, loadedSessions) => handleDateChange(date, loadedSessions)}
          searchNav={searchNav}
          externalDate={selectedDate}
        />

        {/* Hidden recordings — super_admin diagnostic view */}
        {isSuperAdmin && (
          <HiddenRecordingsPanel projectId={projectId} date={selectedDate} />
        )}
      </div>

      {/* Side panel: calendar + map + tasks */}
      <ProjectSidePanel
        projectId={projectId}
        days={days}
        address={address}
        latitude={latitude}
        longitude={longitude}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date)
          fetch(`/api/projects/${projectId}/day-sessions?date=${date}`)
            .then((r) => r.json())
            .then((data) => handleDateChange(date, data.sessions))
            .catch(() => {})
        }}
      />
    </div>
  )
}
