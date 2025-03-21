import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Login from "./pages/Login"
import SignUp from "./pages/SignUp"
import Game from "./pages/Game"
import CreateGame from "./pages/CreateGame"
import JoinGame from "./pages/JoinGame"
import AvailableGames from "./pages/AvailableGames"
import { Toaster } from "react-hot-toast"

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/game/:gameId" element={<Game />} />
        <Route path="/create-game" element={<CreateGame />} />
        <Route path="/join-game" element={<JoinGame />} />
        <Route path="/available-games" element={<AvailableGames />} />
      </Routes>
    </Router>
  )
}

export default App
