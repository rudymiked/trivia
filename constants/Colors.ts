const tintColorLight = '#1B8D94';
const tintColorDark = '#57D3CB';

export const Brand = {
  midnight: '#071A26',
  ocean: '#0F3551',
  teal: '#1B8D94',
  aqua: '#57D3CB',
  sand: '#F4EBDD',
  parchment: '#E7D8BB',
  gold: '#F2C14E',
  coral: '#F28B5B',
  mist: '#B4C7CE',
  slate: '#8CA1A8',
  ink: '#132231',
  white: '#F9FBFB',
} as const;

export default {
  light: {
    text: Brand.ink,
    background: Brand.sand,
    tint: tintColorLight,
    tabIconDefault: '#7D8F95',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: Brand.white,
    background: Brand.midnight,
    tint: tintColorDark,
    tabIconDefault: '#6D7D84',
    tabIconSelected: tintColorDark,
  },
};
