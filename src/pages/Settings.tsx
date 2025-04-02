import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { logger } from "../utils/logger";
import LoadingSpinner from "../components/common/LoadingSpinner";
import PageLayout from "../components/common/PageLayout";
import { useAuth } from "../context/AuthContext";

const Settings = (): JSX.Element => {
  const navigate = useNavigate();
  const { 
    currentUser, 
    userProfile, 
    loading, 
    profileLoading, 
    isAuthenticated, 
    logout
  } = useAuth();

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      logger.warn('Settings', 'User not authenticated, redirecting to login');
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      const err = error as Error;
      logger.error('Settings', 'Logout failed', { error: err });
      toast.error("Failed to logout. Please try again.");
    }
  };

  // Show loading spinner if auth or profile is loading
  if (loading || profileLoading) {
    return (
      <PageLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner message="Loading settings..." />
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

  return (
    <PageLayout>
      <div className="container mx-auto px-4 max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <button
            onClick={() => navigate('/')}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Back to Home
          </button>
        </div>

        {/* Account Information Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Account Information</h3>
          <div className="space-y-2">
            <p className="text-gray-700">
              <span className="font-medium">Email:</span> {userProfile.email}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Username:</span> {userProfile.username || "Not set"}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Member since:</span>{" "}
              {userProfile.createdAt
                ? new Date(userProfile.createdAt.toDate()).toLocaleDateString()
                : "N/A"}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Last update:</span>{" "}
              {userProfile.updatedAt
                ? new Date(userProfile.updatedAt.toDate()).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Security</h3>
          <button
            onClick={() => navigate('/profile')}
            className="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md mb-3 text-left"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-md text-left"
          >
            Logout
          </button>
        </div>

        {/* App Version */}
        <div className="text-center text-gray-500 text-sm mt-8">
          <p>App Version: 1.0.0</p>
        </div>
      </div>
    </PageLayout>
  );
};

export default Settings; 