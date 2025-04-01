import React from "react";
import WagerForm from "../components/forms/WagerForm";
import useCreateGame from "../hooks/useCreateGame";
import LoadingSpinner from "../components/common/LoadingSpinner";
import PageLayout from "../components/common/PageLayout";

export default function CreateGame(): JSX.Element {
  const {
    wager,
    setWager,
    isCreating,
    userBalance,
    isLoading,
    handleCreateGame,
    cancelCreation
  } = useCreateGame();

  if (isLoading) {
    return <LoadingSpinner message="Loading game creation..." />;
  }

  return (
    <PageLayout centered>
      <WagerForm
        wager={wager}
        setWager={setWager}
        userBalance={userBalance}
        isSubmitting={isCreating}
        onSubmit={handleCreateGame}
        onCancel={cancelCreation}
      />
    </PageLayout>
  );
} 