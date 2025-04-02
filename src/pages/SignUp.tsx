import React, { useState, FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { createUserWithEmailAndPassword, AuthError, sendEmailVerification } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "../firebase"
import toast from "react-hot-toast"
import { logger } from "../utils/logger"
import { createNewPlayerRating } from "../utils/ratingSystem"

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
      const user = userCredential.user;
      
      logger.debug('SignUp', 'Auth user created', { 
        userId: user.uid,
        email 
      })
      
      // Send email verification (optional)
      await sendEmailVerification(user);
      
      // Get initial rating using Glicko-2 system
      const initialRating = createNewPlayerRating();
      const now = Date.now();

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email,
        username,
        balance: 1000, // Starting balance
        emailVerified: false,
        stats: {
          wins: 0,
          losses: 0,
          draws: 0,
          eloRating: initialRating.rating,
          ratingDeviation: initialRating.rd,
          volatility: initialRating.vol,
          lastPlayedTimestamp: now,
          eloHistory: {
            [now.toString()]: initialRating.rating
          }
        },
        eloRating: initialRating.rating,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      logger.info('SignUp', 'Signup successful', { 
        userId: user.uid,
        email,
        username,
        initialRating: initialRating.rating,
        initialRD: initialRating.rd
      })
      toast.success("Account created! We've sent a verification email (optional).")
      navigate("/login")
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
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
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
        <div className="mt-4 text-center">
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              navigate("/forgot-password");
            }}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            Forgot Password?
          </a>
        </div>
      </div>
    </div>
  )
} 