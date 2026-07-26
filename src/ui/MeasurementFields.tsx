import type { CardinalDirection, NumberDirectionResponse } from '../app/types'

interface MeasurementFieldsProps {
  value: NumberDirectionResponse
  onChange: (next: NumberDirectionResponse) => void
  disabled?: boolean
}

const DIRECTIONS: Array<{ value: CardinalDirection; label: string; arrow: string }> = [
  { value: 'north', label: 'North', arrow: '↑' },
  { value: 'east', label: 'East', arrow: '→' },
  { value: 'south', label: 'South', arrow: '↓' },
  { value: 'west', label: 'West', arrow: '←' },
  { value: 'none', label: 'None — back at start', arrow: '○' },
]

export function MeasurementFields({ value, onChange, disabled = false }: MeasurementFieldsProps) {
  return (
    <div className="measurement-fields">
      <label>
        Distance
        <span className="input-with-unit">
          <input
            aria-label="Distance in meters"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={value.distance}
            onChange={(event) => onChange({ ...value, distance: event.target.value })}
            disabled={disabled}
          />
          <span>m</span>
        </span>
      </label>
      <label>
        Displacement magnitude
        <span className="input-with-unit">
          <input
            aria-label="Displacement magnitude in meters"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={value.magnitude}
            onChange={(event) => onChange({ ...value, magnitude: event.target.value })}
            disabled={disabled}
          />
          <span>m</span>
        </span>
      </label>
      <fieldset className="direction-field" disabled={disabled}>
        <legend>Displacement direction</legend>
        <div className="direction-grid">
          {DIRECTIONS.map((direction) => (
            <label key={direction.value} className={value.direction === direction.value ? 'direction-choice selected' : 'direction-choice'}>
              <input
                type="radio"
                name="direction"
                value={direction.value}
                checked={value.direction === direction.value}
                onChange={() => onChange({ ...value, direction: direction.value })}
              />
              <span aria-hidden="true">{direction.arrow}</span>
              {direction.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
