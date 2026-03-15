import { Stack } from 'expo-router';

export default function GameLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1A202C',
        },
        headerTintColor: '#FFFFFF',
        headerBackTitle: 'Back',
        contentStyle: {
          backgroundColor: '#1A202C',
        },
      }}
    >
      <Stack.Screen
        name="[puzzleId]"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="results"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />
    </Stack>
  );
}
