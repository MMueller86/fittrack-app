export async function loadHomeData<TWeights, TProfile, TDiary>(requests: {
  weights: Promise<TWeights>;
  profile: Promise<TProfile>;
  diary: Promise<TDiary>;
}): Promise<{
  weights: PromiseSettledResult<TWeights>;
  profile: PromiseSettledResult<TProfile>;
  diary: PromiseSettledResult<TDiary>;
}> {
  const [weights, profile, diary] = await Promise.allSettled([
    requests.weights,
    requests.profile,
    requests.diary,
  ]);

  return { weights, profile, diary };
}