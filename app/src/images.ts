import { ImageSourcePropType } from 'react-native';
import { API_URL } from './api';

const local: Record<string, ImageSourcePropType> = {
  'van-hotel.jpg': require('./assets/van-hotel.jpg'),
  'sedan-lake.jpg': require('./assets/sedan-lake.jpg'),
  'suv-hills.jpg': require('./assets/suv-hills.jpg'),
  'interior-van.jpg': require('./assets/interior-van.jpg'),
  'interior-bench.jpg': require('./assets/interior-bench.jpg'),
  'interior-front.jpg': require('./assets/interior-front.jpg'),
  'driver.jpg': require('./assets/driver.jpg'),
};

export const welcomePhoto = local['van-hotel.jpg'];
export const homePhoto = local['sedan-lake.jpg'];

export function photoSource(path?: string | null): ImageSourcePropType {
  if (!path) return local['van-hotel.jpg'];
  const file = path.split('/').pop() || '';
  if (local[file]) return local[file];
  if (path.startsWith('http')) return { uri: path };
  return { uri: `${API_URL}${path}` };
}
