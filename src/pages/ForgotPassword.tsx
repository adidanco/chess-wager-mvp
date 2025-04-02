import React, { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import toast from "react-hot-toast";
import { logger } from "../utils/logger";

const ForgotPassword = (): JSX.Element => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [resetSent, setResetSent] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    
    try {
      logger.info('ForgotPassword', 'Sending password reset email', { email });
      await sendPasswordResetEmail(auth, email);
      logger.info('ForgotPassword', 'Password reset email sent', { email });
      setResetSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      const err = error as Error;
      logger.error('ForgotPassword', 'Error sending reset email', { error: err, email });
      toast.error(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Forgot Password</h2>
        
        {resetSent ? (
          <div className="text-center">
            <p className="mb-4 text-green-600">
              Password reset link has been sent to your email.
            </p>
            <p className="mb-6 text-gray-600">
              Please check your inbox and follow the instructions to reset your password.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                placeholder="Enter your email address"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Reset Password"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword; 