import React from "react";
import WagerForm from "../components/forms/WagerForm";
import useCreateGame from "../hooks/useCreateGame";
import LoadingSpinner from "../components/common/LoadingSpinner";
import PageLayout from "../components/common/PageLayout";

export default function CreateGame(): JSX.Element {
  const {
    wager,
    setWager,
    timeOption,
    setTimeOption,
    isCreating,
    userBalance,
    isLoading,
    useRealMoney,
    setUseRealMoney,
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
        timeOption={timeOption}
        setTimeOption={setTimeOption}
        userBalance={userBalance}
        isSubmitting={isCreating}
        onSubmit={handleCreateGame}
        onCancel={cancelCreation}
        useRealMoney={useRealMoney}
        setUseRealMoney={setUseRealMoney}
      />
    </PageLayout>
  );
} 