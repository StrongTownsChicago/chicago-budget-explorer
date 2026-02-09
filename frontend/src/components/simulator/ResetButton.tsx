export interface Props {
  onReset: () => void;
}

/**
 * Button to reset all simulation adjustments back to original values (1.0x).
 */
export default function ResetButton({ onReset }: Props) {
  return (
    <button
      onClick={onReset}
      className="btn-secondary px-4 py-2 text-sm"
      aria-label="Reset all department budgets to original values"
    >
      Reset All
    </button>
  );
}
