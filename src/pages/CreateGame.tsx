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
  const [gameTitle, setGameTitle] = useState<string>("");
  const [gameMode, setGameMode] = useState<'friendly' | 'wager'>('friendly');
  const [wagerType, setWagerType] = useState<'coin' | 'real'>('coin');
  const [wagerAmount, setWagerAmount] = useState<number>(10);
  const [creatorColor, setCreatorColor] = useState<'white' | 'black' | 'random'>('random');
  const [timeControl, setTimeControl] = useState<number>(600); // Default 10 minutes
  
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const gameOptions = {
        title: gameTitle,
        wager: gameMode === 'wager' ? wagerAmount : 0,
        isRealMoney: gameMode === 'wager' && wagerType === 'real',
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
                    <label htmlFor="gameTitle" className="form-label">Game Title</label>
                    <input
                      type="text"
                      className="form-control"
                      id="gameTitle"
                      value={gameTitle}
                      onChange={e => setGameTitle(e.target.value)}
                      placeholder="Enter a title for your game"
                      maxLength={30}
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="form-label">Game Mode</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="friendly"
                          name="gameMode"
                          value="friendly"
                          checked={gameMode === 'friendly'}
                          onChange={() => setGameMode('friendly')}
                        />
                        <label className="form-check-label" htmlFor="friendly">Friendly Game</label>
                      </div>
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="wager"
                          name="gameMode"
                          value="wager"
                          checked={gameMode === 'wager'}
                          onChange={() => setGameMode('wager')}
                        />
                        <label className="form-check-label" htmlFor="wager">Wager Game</label>
                      </div>
                    </div>
                  </div>
                  
                  {gameMode === 'wager' && (
                    <>
                      <div className="mb-4">
                        <label className="form-label">Wager Type</label>
                        <div className="d-flex gap-3">
                          <div className="form-check">
                            <input
                              type="radio"
                              className="form-check-input"
                              id="coinWager"
                              name="wagerType"
                              value="coin"
                              checked={wagerType === 'coin'}
                              onChange={() => setWagerType('coin')}
                            />
                            <label className="form-check-label" htmlFor="coinWager">Game Coins</label>
                          </div>
                          <div className="form-check">
                            <input
                              type="radio"
                              className="form-check-input"
                              id="realMoneyWager"
                              name="wagerType"
                              value="real"
                              checked={wagerType === 'real'}
                              onChange={() => setWagerType('real')}
                            />
                            <label className="form-check-label" htmlFor="realMoneyWager">Real Money</label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <label htmlFor="wagerAmount" className="form-label">
                          Wager Amount 
                          {wagerType === 'real' ? ' (₹)' : ' (Coins)'}
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          id="wagerAmount"
                          value={wagerAmount}
                          onChange={e => setWagerAmount(Number(e.target.value))}
                          min={wagerType === 'real' ? 10 : 1}
                          max={wagerType === 'real' ? 5000 : 1000}
                          required={gameMode === 'wager'}
                        />
                        {wagerType === 'real' && (
                          <div className="form-text">
                            Your balance: ₹{userProfile?.realMoneyBalance || 0}
                          </div>
                        )}
                        {wagerType === 'coin' && (
                          <div className="form-text">
                            Your balance: {userProfile?.balance || 0} coins
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  
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
                      disabled={
                        loading || 
                        (gameMode === 'wager' && wagerType === 'coin' && (userProfile?.balance || 0) < wagerAmount) ||
                        (gameMode === 'wager' && wagerType === 'real' && (userProfile?.realMoneyBalance || 0) < wagerAmount)
                      }
                    >
                      {loading ? 'Creating Game...' : 'Create Game'}
                    </button>
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