import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { logger } from "../utils/logger";
import UserStats from "../components/home/UserStats";
import LoadingSpinner from "../components/common/LoadingSpinner";
import PageLayout from "../components/common/PageLayout";
import { useAuth } from "../context/AuthContext";
import { getRatingClassification } from "../utils/eloUtils";

const Profile = (): JSX.Element => {
  const navigate = useNavigate();
  const { 
    currentUser, 
    userProfile, 
    loading, 
    profileLoading, 
    isAuthenticated, 
    stats,
    updateProfile 
  } = useAuth();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [ratingHistory, setRatingHistory] = useState<Array<[number, number]>>([]);

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      logger.warn('Profile', 'User not authenticated, redirecting to login');
      navigate("/login");
    }
    
    if (userProfile) {
      setUsername(userProfile.username || "");
    }
  }, [isAuthenticated, loading, navigate, userProfile]);

  // Process rating history data when profile loads
  useEffect(() => {
    if (userProfile?.stats?.eloHistory) {
      const history = Object.entries(userProfile.stats.eloHistory)
        .map(([timestamp, rating]) => [parseInt(timestamp), rating] as [number, number])
        .sort((a, b) => a[0] - b[0]);
      
      setRatingHistory(history);
    }
  }, [userProfile?.stats?.eloHistory]);

  const handleSaveProfile = async (): Promise<void> => {
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }

    try {
      const success = await updateProfile({ username });
      if (success) {
        setIsEditing(false);
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Profile', 'Error updating profile', { error: err });
      toast.error("Failed to update profile");
    }
  };

  const handleCancel = (): void => {
    setUsername(userProfile?.username || "");
    setIsEditing(false);
  };

  // Show loading spinner if auth or profile is loading
  if (loading || profileLoading) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner message="Loading profile..." />
        </div>
      </PageLayout>
    );
  }

  // Ensure we have a user profile
  if (!userProfile) {
    return (
      <PageLayout>
        <div className="text-center p-4">
          <p className="text-red-600 mb-4">Failed to load user profile.</p>
          <button 
            onClick={() => navigate('/')} 
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Return to Home
          </button>
        </div>
      </PageLayout>
    );
  }

  // Function to draw the rating history chart
  const renderRatingChart = () => {
    if (ratingHistory.length < 2) {
      return (
        <div className="bg-gray-50 p-6 rounded-lg text-center">
          <p className="text-gray-500">
            Not enough rating history to display a chart. Play more games!
          </p>
        </div>
      );
    }

    // Chart dimensions
    const width = 330;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    
    // Find min/max values for scaling
    const ratings = ratingHistory.map(item => item[1]);
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);
    const ratingRange = maxRating - minRating || 100;
    
    // Scale values to fit in our chart height
    const chartHeight = height - padding.top - padding.bottom;
    const chartWidth = width - padding.left - padding.right;
    
    // Scale function for Y axis (ratings)
    const scaleY = (rating: number) => {
      return chartHeight - ((rating - minRating) / ratingRange) * chartHeight + padding.top;
    };
    
    // Scale function for X axis (timestamps)
    const timestamps = ratingHistory.map(item => item[0]);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1000 * 60 * 60 * 24; // Default to 1 day if all same
    
    const scaleX = (time: number) => {
      return ((time - minTime) / timeRange) * chartWidth + padding.left;
    };
    
    // Generate path for line
    const pathData = ratingHistory.map((point, i) => {
      const x = scaleX(point[0]);
      const y = scaleY(point[1]);
      return (i === 0 ? "M" : "L") + x + "," + y;
    }).join(" ");
    
    // Format dates for the X axis
    const formatDate = (timestamp: number) => {
      const date = new Date(timestamp);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    };
    
    // Generate X axis labels (first, middle, last)
    const xAxisLabels = [
      { timestamp: minTime, x: padding.left },
      { timestamp: (minTime + maxTime) / 2, x: padding.left + chartWidth / 2 },
      { timestamp: maxTime, x: padding.left + chartWidth }
    ];
    
    // Generate Y axis labels
    const yAxisLabels = [
      { rating: minRating, y: chartHeight + padding.top },
      { rating: (minRating + maxRating) / 2, y: chartHeight / 2 + padding.top },
      { rating: maxRating, y: padding.top }
    ];
    
    return (
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-3">Rating History</h3>
        <div className="relative">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* X axis */}
            <line
              x1={padding.left}
              y1={chartHeight + padding.top}
              x2={width - padding.right}
              y2={chartHeight + padding.top}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            
            {/* Y axis */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={chartHeight + padding.top}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            
            {/* X axis labels */}
            {xAxisLabels.map((label, i) => (
              <text
                key={`x-label-${i}`}
                x={label.x}
                y={chartHeight + padding.top + 20}
                textAnchor={i === 0 ? "start" : i === 1 ? "middle" : "end"}
                fontSize="10"
                fill="#6b7280"
              >
                {formatDate(label.timestamp)}
              </text>
            ))}
            
            {/* Y axis labels */}
            {yAxisLabels.map((label, i) => (
              <text
                key={`y-label-${i}`}
                x={padding.left - 10}
                y={label.y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill="#6b7280"
              >
                {Math.round(label.rating)}
              </text>
            ))}
            
            {/* Rating line */}
            <path
              d={pathData}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            
            {/* Data points */}
            {ratingHistory.map((point, i) => (
              <circle
                key={`point-${i}`}
                cx={scaleX(point[0])}
                cy={scaleY(point[1])}
                r="3"
                fill="#3b82f6"
              />
            ))}
          </svg>
        </div>
        <div className="text-center text-xs text-gray-500 mt-2">
          Rating trend over time
        </div>
      </div>
    );
  };

  return (
    <PageLayout>
      <div className="container mx-auto px-4 max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Profile</h1>
          <div className="space-x-2">
            <button
              onClick={() => navigate('/settings')}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Settings
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Home
            </button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col items-center">
            {/* Placeholder for profile picture */}
            <div className="w-24 h-24 bg-gray-300 rounded-full mb-4 flex items-center justify-center overflow-hidden">
              {userProfile.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-3xl font-bold text-gray-500">
                  {userProfile.username?.charAt(0).toUpperCase() || userProfile.email?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="w-full">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded mb-2"
                  placeholder="Username"
                />
                <div className="flex space-x-2 justify-center">
                  <button
                    onClick={handleSaveProfile}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-1">{userProfile.username || "User"}</h2>
                <p className="text-gray-600 mb-2">{userProfile.email}</p>
                {userProfile.eloRating && (
                  <div className="mb-4 text-center">
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {getRatingClassification(userProfile.eloRating)}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-2"
                >
                  Edit Username
                </button>
              </>
            )}
          </div>
        </div>

        {/* User Stats Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <UserStats stats={stats} />
        </div>
        
        {/* Rating History Chart */}
        <div className="mb-6">
          {renderRatingChart()}
        </div>
      </div>
    </PageLayout>
  );
};

export default Profile; 