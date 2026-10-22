import { useState } from 'react'
import { PERIOD_WORDS, formatMinutes, isTracked, todayLabel } from '../goals'
import { areaCards, areasColour, goalColourFor, goalDisplay, ringCentre, todayGoals, type AreaCard, type AreaGoal } from '../todayAreas'
import { goalTapAction } from '../goalTap'
import type { AppData, GoalDef, GoalProgress } from '../types'

const MAX_PER_ROW = 4 // more areas than this wrap onto a second row
const RADIUS = 27
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// An area's ring: filled by the average progress of its goals; the middle says how many are met.
function AreaRing({ card, selected, onSelect }: { card: AreaCard; selected: boolean; onSelect: () => void }) {
  const filled = card.fraction * CIRCUMFERENCE
  return (
    <button
      className={selected ? 'area-ring on' : 'area-ring'}
      aria-pressed={selected}
      aria-label={card.total === 0 ? `${card.name}, nothing to do` : card.met === 0 ? `${card.name}, ${card.total} ${card.total === 1 ? 'goal' : 'goals'}` : `${card.name}, ${card.met} of ${card.total} goals met`}
      onClick={onSelect}
    >
      <svg viewBox="0 0 72 72" className="area-ring-dial" aria-hidden="true">
        <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="var(--color-ring-track)" strokeWidth="7" />
        {filled > 0 && (
          // A zero-length arc with round caps would still draw a dot, so skip it.
          <circle
            cx="36"
            cy="36"
            r={RADIUS}
            fill="none"
            stroke={card.colour}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            transform="rotate(-90 36 36)"
          />
        )}
        <text x="36" y="41" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-text)">
          {ringCentre(card.met, card.total)}
        </text>
      </svg>
      <span className="area-ring-name">{card.name}</span>
    </button>
  )
}

function Bubble({ on, colour, big }: { on: boolean; colour: string; big?: boolean }) {
  return (
    <span className={`bubble${on ? ' on' : ''}${big ? ' big' : ''}`} style={on ? { background: colour } : undefined}>
      {on ? '✓' : ''}
    </span>
  )
}

// A task's bubble in a Chores-style goal: a ring that fills as the task gets done (a third of the
// way after one of three taps; the share of its minutes for a timed task), a number inside for a
// task counted in taps, and a filled ✓ once it has had what it needs.
const STEP_R = 12.5
const STEP_C = 2 * Math.PI * STEP_R
function StepBubble({ step, colour }: { step: { count: number; need: number; unit: 'taps' | 'minutes'; done: boolean }; colour: string }) {
  if (step.done) return <Bubble on colour={colour} big />
  const fraction = Math.min(step.count / step.need, 1)
  return (
    <span className="step-dial">
      <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true">
        <circle cx="15" cy="15" r={STEP_R} fill="none" stroke="var(--color-ring-track)" strokeWidth="3" />
        {fraction > 0 && (
          <circle
            cx="15"
            cy="15"
            r={STEP_R}
            fill="none"
            stroke={colour}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${fraction * STEP_C} ${STEP_C}`}
            transform="rotate(-90 15 15)"
          />
        )}
      </svg>
      {step.unit === 'taps' && step.count > 0 && <span className="step-dial-count">{step.count}</span>}
    </span>
  )
}

// "1/3" for a task needed several times, "45m/2h" for one needed for a length of time; nothing
// for the usual once-only task.
function progressText(s: { count: number; need: number; unit: 'taps' | 'minutes' }): string | null {
  if (s.unit === 'minutes') return `${formatMinutes(Math.min(s.count, s.need))}/${formatMinutes(s.need)}`
  return s.need > 1 ? `${Math.min(s.count, s.need)}/${s.need}` : null
}

// One goal, drawn by what it is: a bar, a few bubbles, or a labelled bubble per task.
function GoalRow({
  item,
  colour,
  onLogTask,
  onUnlogTask,
  onTapGoal,
  taskColour,
}: {
  item: AreaGoal
  colour: string
  taskColour?: (areas: string[]) => string | null // a Routine's tasks keep their own area colour
  onLogTask?: (quickWinId: string) => void
  onUnlogTask?: (goal: GoalDef, quickWinId: string) => void
  onTapGoal?: (goal: GoalDef, progress: GoalProgress) => void
}) {
  const { goal, progress, steps } = item
  const display = goalDisplay(goal, progress)
  const tracked = isTracked(goal) // a container routine shows just its name and tasks
  // A goal that counts by tapping is a button on its name line (not on the Chores-style bubbles,
  // which have their own taps); the rest of the row stays as it was.
  const tappable = onTapGoal !== undefined && goalTapAction(goal, progress) !== null
  const tap = () => onTapGoal?.(goal, progress)
  if (display === 'task') {
    const body = (
      <>
        <span className="goal-row-title">{goal.title}</span>
        {progress.met && <Bubble on colour={colour} />}
      </>
    )
    return (
      <div className="goal-row">
        {tappable ? (
          <button className="goal-row-head goal-row-tap" onClick={tap} aria-label={progress.met ? `Take back ${goal.title}` : `Complete ${goal.title}`}>
            {body}
          </button>
        ) : (
          <div className="goal-row-head">{body}</div>
        )}
      </div>
    )
  }
  const label = todayLabel(goal, progress)

  return (
    <div className="goal-row">
      {tappable ? (
        <button className="goal-row-head goal-row-tap" onClick={tap} aria-label={`Log ${goal.title}`}>
          <span>
            <span className="goal-row-title">{goal.title}</span> {tracked && <span className="muted period">{PERIOD_WORDS[goal.period].this}</span>}
          </span>
          <span className="muted nowrap">
            {progress.met && tracked ? '✓ ' : ''}
            {label}
          </span>
        </button>
      ) : (
        <div className="goal-row-head">
          <span>
            <span className="goal-row-title">{goal.title}</span> {tracked && <span className="muted period">{PERIOD_WORDS[goal.period].this}</span>}
          </span>
          <span className="muted nowrap">
            {progress.met && tracked ? '✓ ' : ''}
            {label}
          </span>
        </div>
      )}
      {display === 'bar' && (
        <div className="goal-bar" role="img" aria-label={`${Math.round(progress.fraction * 100)} percent`}>
          <div className="goal-bar-fill" style={{ width: `${progress.fraction * 100}%`, background: colour }} />
        </div>
      )}
      {display === 'bubbles' && (
        <div className="bubbles" role="img" aria-label={`${Math.min(progress.done, progress.target)} of ${progress.target} done`}>
          {Array.from({ length: progress.target }, (_, i) => (
            <Bubble key={i} on={i < progress.done} colour={colour} />
          ))}
        </div>
      )}
      {display === 'steps' && (
        <div className="steps">
          {(steps ?? []).map((s) => {
            const inner = (
              <>
                <StepBubble step={s} colour={taskColour?.(s.areas) ?? colour} />
                <span className="step-name">
                  <span className="sr-only">{s.done ? 'Done: ' : 'Not yet: '}</span>
                  {s.title}
                  {progressText(s) && <span className="sr-only"> {progressText(s)}</span>}
                </span>
              </>
            )
            // Tapping a task that isn't done logs it (or asks how long, if it is set to); tapping one
            // that is done takes the latest log back, so a slip is one tap to fix.
            if (!s.done && onLogTask) {
              return (
                <button key={s.id} className="step step-button" aria-label={progressText(s) ? `Log ${s.title} (${progressText(s)})` : `Log ${s.title}`} onClick={() => onLogTask(s.id)}>
                  {inner}
                </button>
              )
            }
            if (s.done && onUnlogTask) {
              return (
                <button key={s.id} className="step step-button" aria-label={`Remove ${s.title}`} onClick={() => onUnlogTask(goal, s.id)}>
                  {inner}
                </button>
              )
            }
            return (
              <span key={s.id} className="step">
                {inner}
              </span>
            )
          })}
          {(steps ?? []).length === 0 && <span className="muted">Tag repeatable tasks to this goal in Manage.</span>}
        </div>
      )}
    </div>
  )
}

// Today's goals: every goal for the week in one list, coloured by its area, with a ring per
// area (the ones switched on in Manage) above it as a summary. Tap a ring to narrow the list to
// that area (its to-dos join in); tap it again to see everything.
type RingsProps = {
  data: AppData
  now: Date
  onLogTask?: (quickWinId: string) => void
  onUnlogTask?: (goal: GoalDef, quickWinId: string) => void
  onTapGoal?: (goal: GoalDef, progress: GoalProgress) => void
}

export function AreaRings({ data, now, onLogTask, onUnlogTask, onTapGoal }: RingsProps) {
  const cards = areaCards(data, now)
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const picked = cards.find((c) => c.key === pickedKey) // a ring that has since gone means "all"
  const everything = todayGoals(data, now)
  const taskColour = (areas: string[]) => areasColour(data.areas, areas)

  return (
    <div className="area-rings">
      {cards.length > 0 && (
        <div className="area-ring-row" style={{ ['--cols' as string]: Math.min(cards.length, MAX_PER_ROW) }}>
          {cards.map((card) => (
            <AreaRing
              key={card.key}
              card={card}
              selected={picked?.key === card.key}
              onSelect={() => setPickedKey(picked?.key === card.key ? null : card.key)}
            />
          ))}
        </div>
      )}
      <div className="area-goals" aria-label={picked ? `${picked.name} goals` : 'Goals'}>
        {picked
          ? picked.goals.map((item) => <GoalRow key={item.goal.id} item={item} colour={picked.colour} onLogTask={onLogTask} onUnlogTask={onUnlogTask} onTapGoal={onTapGoal} />)
          : everything.map((item) => <GoalRow key={item.goal.id} item={item} colour={goalColourFor(data.areas, item.goal)} onLogTask={onLogTask} onUnlogTask={onUnlogTask} onTapGoal={onTapGoal} taskColour={taskColour} />)}
        {picked && picked.total === 0 && <p className="muted">Nothing in {picked.name} yet.</p>}
      </div>
    </div>
  )
}
