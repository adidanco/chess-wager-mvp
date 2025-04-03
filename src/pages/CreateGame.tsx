import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import PageLayout from "../components/common/PageLayout";
import { useCreateGame } from "../hooks/useCreateGame";
import { AuthContext } from "../context/AuthContext";

export default function CreateGame() {
  const navigate = useNavigate();
  const { userProfile } = useContext(AuthContext) || {};
  const { createGame, loading } = useCreateGame();
  
  // Game settings
  const [wagerAmount, setWagerAmount] = useState<number>(10);
  const [creatorColor, setCreatorColor] = useState<'white' | 'black' | 'random'>('random');
  const [timeControl, setTimeControl] = useState<number>(600); // Default 10 minutes
  
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Ensure gameOptions matches the expected interface in useCreateGame.ts
      const gameOptions = {
        title: `${userProfile?.username || 'Anonymous'}'s Game`,
        wager: wagerAmount,
        isRealMoney: true, // Always real money
        creatorColor,
        timeControl
      };
      
      const gameId = await createGame(gameOptions);
      
      if (gameId) {
        toast.success("Game created successfully!");
        navigate(`/game/${gameId}`);
      }
    } catch (error: any) {
      console.error("Error creating game:", error);
      toast.error(error.message || "Failed to create game");
    }
  };

  return (
    <PageLayout>
      <div className="container mt-4">
        <div className="row">
          <div className="col-md-8 mx-auto">
            <div className="card shadow-sm">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">Create a New Game</h4>
              </div>
              <div className="card-body">
                <form onSubmit={handleCreateGame}>
                  <div className="mb-3">
                    <label htmlFor="wagerAmount" className="form-label">
                      Wager Amount (₹)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="wagerAmount"
                      value={wagerAmount}
                      onChange={e => setWagerAmount(Number(e.target.value))}
                      min={10}
                      max={5000}
                      required
                    />
                    <div className="form-text">
                      Your balance: ₹{userProfile?.realMoneyBalance || 0}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Choose Your Color</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="white"
                          name="creatorColor"
                          value="white"
                          checked={creatorColor === 'white'}
                          onChange={() => setCreatorColor('white')}
                        />
                        <label className="form-check-label" htmlFor="white">White</label>
                      </div>
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="black"
                          name="creatorColor"
                          value="black"
                          checked={creatorColor === 'black'}
                          onChange={() => setCreatorColor('black')}
                        />
                        <label className="form-check-label" htmlFor="black">Black</label>
                      </div>
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="random"
                          name="creatorColor"
                          value="random"
                          checked={creatorColor === 'random'}
                          onChange={() => setCreatorColor('random')}
                        />
                        <label className="form-check-label" htmlFor="random">Random</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">Game Duration</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="minutes5"
                          name="timeControl"
                          value="300"
                          checked={timeControl === 300}
                          onChange={() => setTimeControl(300)}
                        />
                        <label className="form-check-label" htmlFor="minutes5">5 Minutes</label>
                      </div>
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="minutes10"
                          name="timeControl"
                          value="600"
                          checked={timeControl === 600}
                          onChange={() => setTimeControl(600)}
                        />
                        <label className="form-check-label" htmlFor="minutes10">10 Minutes</label>
                      </div>
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="minutes15"
                          name="timeControl"
                          value="900"
                          checked={timeControl === 900}
                          onChange={() => setTimeControl(900)}
                        />
                        <label className="form-check-label" htmlFor="minutes15">15 Minutes</label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="d-grid gap-2">
                    <button 
                      type="submit" 
                      className="btn btn-primary btn-lg"
                      disabled={loading || wagerAmount <= 0 || wagerAmount > (userProfile?.realMoneyBalance || 0)}
                    >
                      {loading ? 'Creating Game...' : 'Create Game'}
                    </button>
                    {wagerAmount > (userProfile?.realMoneyBalance || 0) && (
                      <div className="text-danger">
                        Insufficient balance. Please add funds or reduce wager amount.
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
} 