import React, { useState, FormEvent, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { signInWithEmailAndPassword, AuthError } from "firebase/auth"
import { doc, updateDoc, getDoc, serverTimestamp, query, where, collection, getDocs } from "firebase/firestore"
import { auth, db } from "../firebase"
import toast from "react-hot-toast"
import { logger, createLogger } from '../utils/logger'
// Create a component-specific logger
const LoginLogger = createLogger('Login');


export default function Login(): JSX.Element {
  const navigate = useNavigate()
  const [loading, setLoading] = useState<boolean>(false)
  const [loginMethod, setLoginMethod] = useState<'email' | 'mobile'>('email')
  
  // Email/Password login states
  const [usernameOrEmail, setUsernameOrEmail] = useState<string>("")
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
      // Check if input is email or username
      let email = usernameOrEmail
      
      // If it doesn't look like an email, assume it's a username and look it up
      if (!usernameOrEmail.includes('@')) {
        const userQuery = query(
          collection(db, "users"), 
          where("username", "==", usernameOrEmail)
        )
        
        const querySnapshot = await getDocs(userQuery)
        
        if (querySnapshot.empty) {
          throw new Error("Username not found. Please check and try again.")
        }
        
        email = querySnapshot.docs[0].data().email
        
        if (!email) {
          throw new Error("Account has no associated email. Please contact support.")
        }
      }
      
      // Now login with the email
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      
      // Record the successful login in Firestore
      const userRef = doc(db, "users", userCredential.user.uid)
      const userDoc = await getDoc(userRef)
      
      if (userDoc.exists()) {
        await updateDoc(userRef, {
          lastLogin: serverTimestamp()
        })
      }
      
      LoginLogger.info('Login successful with email/password', { 
        userId: userCredential.user.uid, 
        email 
      })
      
      toast.success("Logged in successfully!")
      navigate("/")
    } catch (error) {
      const err = error as Error
      LoginLogger.error('Login failed', { error: err })
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleSendMobileOtp = async (): Promise<void> => {
    if (!mobileNumber || mobileNumber.length < 10) {
      toast.error("Please enter a valid mobile number")
      return
    }
    
    setLoading(true)
    
    try {
      // In a real app, we would send an OTP via SMS here
      // For demo purposes, we're simulating success
      
      LoginLogger.info('Sending OTP to mobile', { mobileNumber })
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMobileOtpSent(true)
      setShowMobileOtpInput(true)
      toast.success(`OTP sent to ${mobileNumber}. For demo, use code: ${DEMO_OTP}`)
    } catch (error) {
      const err = error as Error
      LoginLogger.error('Failed to send OTP', { error: err, mobileNumber })
      toast.error("Failed to send OTP. Please try again.")
    } finally {
      setLoading(false)
    }
  }
  
  const handleMobileLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    
    if (!mobileOtpSent) {
      await handleSendMobileOtp()
      return
    }
    
    if (!mobileOtp) {
      toast.error("Please enter the OTP sent to your mobile")
      return
    }
    
    setLoading(true)
    
    try {
      // Verify OTP
      if (mobileOtp !== DEMO_OTP) {
        throw new Error("Invalid OTP. Please try again.")
      }
      
      // In a real app, we would verify the OTP and get the user ID associated with this mobile
      // For demo, we'll simulate finding a user
      
      // This would be a query to find user by mobile number in a real app
      const userQuery = query(
        collection(db, "users"),
        where("username", "!=", "") // Just a dummy query to get a user
      )
      
      const querySnapshot = await getDocs(userQuery)
      
      if (querySnapshot.empty) {
        throw new Error("No user account found for this mobile number")
      }
      
      // Get the first user for demo
      const userDoc = querySnapshot.docs[0]
      const userData = userDoc.data()
      
      // Record the successful login
      await updateDoc(doc(db, "users", userDoc.id), {
        lastLogin: serverTimestamp(),
        mobileVerified: true
      })
      
      LoginLogger.info('Login successful with mobile OTP', { 
        userId: userDoc.id, 
        mobileNumber 
      })
      
      // Since we can't actually log in with mobile (Firebase needs email/pass),
      // we're simulating successful login and manually redirecting
      toast.success("Logged in successfully with mobile number!")
      navigate("/")
    } catch (error) {
      const err = error as Error
      LoginLogger.error('Mobile login failed', { error: err, mobileNumber })
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
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
            Email/Username
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
                Email or Username
              </label>
              <input
                type="text"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
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
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mobile Number
              </label>
              <div className="flex mt-1">
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => {
                    // Reset OTP fields if mobile number changes
                    if (e.target.value !== mobileNumber) {
                      setMobileOtpSent(false)
                      setShowMobileOtpInput(false)
                    }
                    setMobileNumber(e.target.value)
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  pattern="[0-9]{10}"
                  placeholder="10-digit number"
                />
                {!showMobileOtpInput && (
                  <button
                    type="button"
                    onClick={handleSendMobileOtp}
                    disabled={loading || mobileNumber.length < 10}
                    className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send OTP"}
                  </button>
                )}
              </div>
            </div>
            
            {showMobileOtpInput && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  OTP Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={mobileOtp}
                  onChange={(e) => setMobileOtp(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  pattern="[0-9]{4}"
                  placeholder="Enter 4-digit OTP"
                  maxLength={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  For demo purposes, use code: {DEMO_OTP}
                </p>
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={handleSendMobileOtp}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            )}
            
            {showMobileOtpInput && (
              <button
                type="submit"
                disabled={loading || !mobileOtp}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Login with OTP"}
              </button>
            )}
            
            {!showMobileOtpInput && (
              <button
                type="submit"
                disabled={loading || mobileNumber.length < 10}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? "Sending OTP..." : "Continue"}
              </button>
            )}
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