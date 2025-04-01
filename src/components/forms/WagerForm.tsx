import React, { FormEvent } from "react";
import { CURRENCY_SYMBOL } from "../../utils/constants";

/**
 * Interface for WagerForm props
 */
interface WagerFormProps {
  wager: string;
  setWager: (wager: string) => void;
  userBalance: number;
  isSubmitting: boolean;
  onSubmit: (e: FormEvent) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
}

/**
 * Reusable component for the wager form
 */
const WagerForm = ({
  wager,
  setWager,
  userBalance,
  isSubmitting,
  onSubmit,
  onCancel,
  submitLabel = "Create Game",
  submittingLabel = "Creating...",
  cancelLabel = "Cancel",
}: WagerFormProps): JSX.Element => {
  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-96">
      <h2 className="text-2xl font-bold mb-6 text-center">Create New Game</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Wager Amount ({CURRENCY_SYMBOL})
          </label>
          <input
            type="number"
            value={wager}
            onChange={(e) => setWager(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter wager amount"
            min="1"
            required
          />
          {userBalance !== null && (
            <p className="mt-1 text-sm text-gray-500">
              Your balance: {CURRENCY_SYMBOL}{userBalance.toFixed(2)}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${
            isSubmitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          {cancelLabel}
        </button>
      </form>
    </div>
  );
};

export default WagerForm; 