import { useEffect, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { auth, db } from "../firebase"
import { useNavigate, Link } from "react-router-dom"

export default function Home() {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const depositAmounts = [5, 10, 15, 30, 50]; // Available deposit options 
  // ADDED: State to control deposit menu visibility
  const [showDepositMenu, setShowDepositMenu] = useState(false);
  const navigate = useNavigate();

  const handleDeposit = async (amount) => {
    if (!user) return; // Prevent deposits if user is not logged in
  
    const userRef = doc(db, "users", user.uid);
  
    try {
      // Get current balance from Firestore
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentBalance = userSnap.data().balance || 0;
  
        // Update Firestore with new balance
        await updateDoc(userRef, {
          balance: currentBalance + amount,
        });
  
        // Update UI instantly
        setUserData((prev) => ({
          ...prev,
          balance: currentBalance + amount,
        }));
      }
    } catch (err) {
      console.error("Deposit failed:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null)
        setUserData(null)
      } else {
        setUser(currentUser)
        const userDoc = await getDoc(doc(db, "users", currentUser.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data())
        }
      }
    })
    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
    navigate("/login")
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded shadow">
          <h1 className="text-xl mb-4">You are not logged in!</h1>
          <a href="/login" className="text-blue-500">Go to Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Chess Wager</h1>
      
      {!auth.currentUser ? (
        <div className="space-y-4">
          <p className="text-lg">Please log in or sign up to play!</p>
          <div className="flex gap-4">
            <Link to="/login" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Login
            </Link>
            <Link to="/signup" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
              Sign Up
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Your Balance: ₹{userData?.balance ?? 0}</h2>
            <div className="flex gap-4">
              <Link to="/create-game" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Create Game
              </Link>
              <Link to="/available-games" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                Join Game
              </Link>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="max-w-xl mx-auto bg-white p-6 rounded shadow">
            <h1 className="text-2xl font-bold mb-4">Welcome, {userData?.username || user.email}</h1>
            <p className="mb-2">Stats: 
              W: {userData?.stats?.wins} |
              L: {userData?.stats?.losses} |
              D: {userData?.stats?.draws}
            </p>
            <button
              onClick={() => setShowDepositMenu(true)}
              className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Deposit Money
            </button>

            {showDepositMenu && (
              <div className="mt-4 bg-white p-4 shadow rounded">
                <h2 className="text-lg font-semibold mb-2">Select Amount to Deposit</h2>
                <div className="flex gap-2">
                  {depositAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => {
                        handleDeposit(amount);
                        setShowDepositMenu(false);
                      }}
                      className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                    >
                      ₹{amount}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowDepositMenu(false)}
                  className="mt-2 text-red-500"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
