import React, { useState, FormEvent, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "../firebase"
import toast from "react-hot-toast"
import { logger } from "../utils/logger"

export default function Login(): JSX.Element {
  const navigate = useNavigate()
  const [loading, setLoading] = useState<boolean>(false)
  const [loginMethod, setLoginMethod] = useState<'email' | 'mobile'>('email')
  
  // Email/Password login states
  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  
  // Mobile login states
  const [mobileNumber, setMobileNumber] = useState<string>("")
  const [showMobileOtpInput, setShowMobileOtpInput] = useState<boolean>(false)
  const [mobileOtp, setMobileOtp] = useState<string>("")
  const [mobileOtpSent, setMobileOtpSent] = useState<boolean>(false)

  // For demo purposes, we'll use a fixed OTP
  const DEMO_OTP = "1234"

  useEffect(() => {
    // Check if the current user is already logged in
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        navigate("/")
      }
    })

    return () => unsubscribe()
  }, [navigate])

  const handleEmailLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Login with email
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      
      // Record the successful login in Firestore
      const userRef = doc(db, "users", userCredential.user.uid)
      const userDoc = await getDoc(userRef)
      
      if (userDoc.exists()) {
        await updateDoc(userRef, {
          lastLogin: serverTimestamp()
        })
      }
      
      logger.info('Login', 'Login successful with email/password', { 
        userId: userCredential.user.uid, 
        email 
      })
      
      toast.success("Logged in successfully!")
      navigate("/")
    } catch (error) {
      const err = error as Error
      logger.error('Login', 'Login failed', { error: err })
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSendMobileOtp = async (): Promise<void> => {
    toast.error("Mobile login is currently under development. Please use email login.")
    return
  }
  
  const handleMobileLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    toast.error("Mobile login is currently under development. Please use email login.")
    return
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
        
        {/* Login Method Tabs */}
        <div className="flex mb-6 border-b">
          <button
            onClick={() => setLoginMethod('email')}
            className={`flex-1 py-2 font-medium ${
              loginMethod === 'email'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Email
          </button>
          <button
            onClick={() => setLoginMethod('mobile')}
            className={`flex-1 py-2 font-medium ${
              loginMethod === 'mobile'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Mobile Number
          </button>
        </div>
        
        {loginMethod === 'email' ? (
          <form onSubmit={handleEmailLogin} className="space-y-4">
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
          </form>
        ) : (
          <form onSubmit={handleMobileLogin} className="space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 font-medium">
                    Mobile login is currently under development
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Please use email login instead.
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mobile Number
              </label>
              <div className="flex mt-1">
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  pattern="[0-9]{10}"
                  placeholder="10-digit number"
                  disabled={true}
                />
                <button
                  type="button"
                  onClick={handleSendMobileOtp}
                  disabled={true}
                  className="ml-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-md disabled:opacity-50"
                >
                  Send OTP
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={true}
              className="w-full bg-gray-300 text-gray-500 py-2 px-4 rounded-md disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        )}
        
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  )
} 