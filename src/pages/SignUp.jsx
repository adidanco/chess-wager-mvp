import { useState } from "react"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { auth, db } from "../firebase"
import { useNavigate } from "react-router-dom"

export default function SignUp() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password)
      const userId = userCred.user.uid

      await setDoc(doc(db, "users", userId), {
        username: username || "Unnamed",
        balance: 0,
        stats: { wins: 0, losses: 0, draws: 0 },
        currentGameId: null,
      })

      // Mark success & redirect using React Router
      setSuccess(true)
      setTimeout(() => {
        navigate("/login")
      }, 1500)

    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("Email already in use. Try logging in.")
      } else {
        setError(err.message)
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleSignUp} className="p-6 bg-white rounded shadow w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
        {error && <p className="text-red-500 mb-2">{error}</p>}
        {success && <p className="text-green-500 mb-2">Sign-up successful! Redirecting...</p>}

        <div className="mb-4">
          <label className="block mb-1">Username</label>
          <input
            className="w-full border px-3 py-2"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Optional username"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1">Email</label>
          <input
            className="w-full border px-3 py-2"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1">Password</label>
          <input
            className="w-full border px-3 py-2"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="******"
          />
        </div>

        <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full">
          Sign Up
        </button>

        <p className="mt-2 text-sm text-center">
          Already have an account?{" "}
          <a className="text-blue-500" href="/login">
            Log In
          </a>
        </p>
      </form>
    </div>
  )
}
