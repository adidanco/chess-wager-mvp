import React, { useState, FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { signInWithEmailAndPassword, AuthError } from "firebase/auth"
import { auth } from "../firebase"
import toast from "react-hot-toast"
import { logger } from "../utils/logger"

export default function Login(): JSX.Element {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setLoading(true)
    logger.info('Login', 'Attempting login', { email })

    try {
      await signInWithEmailAndPassword(auth, email, password)
      logger.info('Login', 'Login successful', { email })
      toast.success("Logged in successfully!")
      navigate("/")
    } catch (error) {
      const err = error as AuthError
      logger.error('Login', 'Login failed', { 
        error: err, 
        errorCode: err.code,
        email 
      })
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Create Account
          </button>
        </form>
        <div className="mt-6 text-center">
          <div className="text-pink-500 font-bold text-xl bg-white/80 px-3 py-1 rounded-full shadow-sm inline-block">Boo Boo ❤️</div>
        </div>
      </div>
    </div>
  )
} 