import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { colors } from '../theme';

const SCALLOPS = 'M 0 16' + ' a 15 15 0 0 0 30 0'.repeat(13) + ' L 390 0 L 0 0 Z';
const DOT_XS = Array.from({ length: 13 }, (_, i) => 15 + i * 30);
const TRI_XS = [30, 90, 150, 210, 270, 330];

/** The marigold scallop, magenta dots and green triangles strip at the top of Home. */
export function Bunting({ width = 390 }: { width?: number }) {
  const height = (54 * width) / 390;
  return (
    <Svg width={width} height={height} viewBox="0 0 390 54">
      <Path d={SCALLOPS} fill={colors.marigold} />
      <G fill={colors.magentaBright}>
        {DOT_XS.map((x) => (
          <Circle key={x} cx={x} cy={32} r={4} />
        ))}
      </G>
      <G fill={colors.green}>
        {TRI_XS.map((x) => (
          <Path key={x} d={`M ${x} 40 L ${x + 14} 40 L ${x + 7} 54 Z`} />
        ))}
      </G>
    </Svg>
  );
}
