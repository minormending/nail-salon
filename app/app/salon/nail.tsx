import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { DIGITS } from '../../src/state/store';

/**
 * The one-nail close-up is now the nail chair zoomed in on a fingertip. Old links
 * (`/salon/nail?digit=index`) land on the same nail there.
 */
export default function SalonNail() {
  const params = useLocalSearchParams<{ digit?: string }>();
  const digit = DIGITS.find((d) => d === params.digit) ?? 'thumb';
  return <Redirect href={`/salon/nails?zoom=${digit}` as never} />;
}
