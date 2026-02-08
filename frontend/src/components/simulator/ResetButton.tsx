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
      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold text-sm"
      aria-label="Reset all department budgets to original values"
    >
      Reset All
    </button>
  );
}
