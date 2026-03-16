import { ColorSchemeName, useColorScheme as useColorSchemeCore } from 'react-native';

export const useColorScheme = (): NonNullable<ColorSchemeName> => {
  const coreScheme = useColorSchemeCore();
  return coreScheme ?? 'light';
};
