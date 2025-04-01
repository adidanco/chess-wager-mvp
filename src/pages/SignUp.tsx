import React, { useState, FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { createUserWithEmailAndPassword, AuthError } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { auth, db } from "../firebase"
import toast from "react-hot-toast"
import { logger } from "../utils/logger"

export default function SignUp(): JSX.Element {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [username, setUsername] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setLoading(true)
    logger.info('SignUp', 'Attempting signup', { email, username })

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      logger.debug('SignUp', 'Auth user created', { 
        userId: userCredential.user.uid,
        email 
      })

      // Create user document in Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        username,
        balance: 1000, // Starting balance
        stats: {
          wins: 0,
          losses: 0,
          draws: 0
        },
        createdAt: new Date()
      })

      logger.info('SignUp', 'Signup successful', { 
        userId: userCredential.user.uid,
        email,
        username 
      })
      toast.success("Account created successfully!")
      navigate("/")
    } catch (error) {
      const err = error as AuthError
      logger.error('SignUp', 'Signup failed', { 
        error: err, 
        errorCode: err.code,
        email,
        username 
      })
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Create Account</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
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
            {loading ? "Creating Account..." : "Create Account"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Back to Login
          </button>
        </form>
        <div className="mt-6 text-center">
          <div className="text-pink-500 font-bold text-xl bg-white/80 px-3 py-1 rounded-full shadow-sm inline-block">Boo Boo ❤️</div>
        </div>
      </div>
    </div>
  )
} 