import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Bunting } from '../src/components/Bunting';
import { Button } from '../src/components/Button';
import { HardDrop } from '../src/components/HardDrop';
import { IconButton } from '../src/components/IconButton';
import { Screen } from '../src/components/Screen';
import { border, colors, fonts } from '../src/theme';

function PaisleyMark() {
  return (
    <Svg width={30} height={38} viewBox="0 0 30 38">
      <Path
        d="M 15 36 C 3 32, 1 18, 9 10 C 15 4, 25 4, 27 11 C 29 18, 20 21, 16 17 C 13 14, 16 10, 19 12"
        fill="none"
        stroke={colors.magenta}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Circle cx={19} cy={12} r={2.4} fill={colors.marigold} />
    </Svg>
  );
}

type CardProps = {
  bg: string;
  fg: string;
  caps: string;
  title: string;
  quote: string;
  blurb: string;
  blurbFont: string;
  onPress: () => void;
  children?: React.ReactNode;
};

function RoomCard({ bg, fg, caps, title, quote, blurb, blurbFont, onPress, children }: CardProps) {
  return (
    <HardDrop
      onPress={onPress}
      drop={5}
      radius={22}
      accessibilityLabel={`${title}. ${quote} ${blurb}`}
      face={{ flexDirection: 'row', alignItems: 'stretch', gap: 14, padding: 14, backgroundColor: bg }}
    >
      <View style={{ flex: 1, justifyContent: 'center', gap: 4, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 1, color: fg }}>{caps}</Text>
        <Text
          style={{
            fontFamily: fonts.heading,
            fontSize: 30,
            lineHeight: 34,
            color: fg,
            includeFontPadding: false,
          }}
        >
          {title}
        </Text>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19.5, color: fg }}>{quote}</Text>
        <Text style={{ marginTop: 6, fontFamily: blurbFont, fontSize: 12.5, lineHeight: 17.5, color: fg }}>
          {blurb}
        </Text>
      </View>
      {children}
    </HardDrop>
  );
}

/** The white rounded picture box on each card. */
function PictureBox({ children }: { children?: React.ReactNode }) {
  return (
    <View
      style={{
        width: 104,
        height: 150,
        borderRadius: 16,
        borderWidth: border,
        borderColor: colors.plum,
        backgroundColor: colors.white,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Bunting width={width} />

        <View style={{ paddingTop: 14, paddingHorizontal: 22, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PaisleyMark />
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.heading,
                fontSize: 52,
                lineHeight: 60,
                letterSpacing: -0.5,
                color: colors.plum,
                includeFontPadding: false,
              }}
            >
              Paisley
            </Text>
          </View>
          <Text
            style={{
              marginTop: 0,
              fontFamily: fonts.bodyHeavy,
              fontSize: 13,
              letterSpacing: 1.2,
              color: colors.muted,
            }}
          >
            NAIL &amp; HENNA STUDIO
          </Text>
          <Text
            style={{
              marginTop: 22,
              fontFamily: fonts.heading,
              fontSize: 24,
              lineHeight: 28,
              color: colors.plum,
              includeFontPadding: false,
            }}
          >
            Who's decorating today?
          </Text>
        </View>

        <View style={{ paddingTop: 14, paddingHorizontal: 18, gap: 14 }}>
          <RoomCard
            bg={colors.magenta}
            fg={colors.cream}
            caps="FREE · EASY AS TAPPING"
            title="The Salon"
            quote="“You can't get it wrong.”"
            blurb="Big bottles, stickers that land where you tap, henna that draws itself on."
            blurbFont={fonts.bodySemi}
            onPress={() => router.push('/salon/nails')}
          >
            {/* TODO(art): wire the almond-nail hand art (magenta almond nails) in here. */}
            <PictureBox />
          </RoomCard>

          <RoomCard
            bg={colors.turquoise}
            fg={colors.plum}
            caps="FULL CONTROL · FREE WHILE IT'S NEW"
            title="The Studio"
            quote="“You can make anything.”"
            blurb="A real henna cone, motif stamps, mirroring, layers and full undo."
            blurbFont={fonts.bodyBold}
            onPress={() => router.push('/studio')}
          >
            {/* TODO(art): wire the finished reddish-brown henna hand art in here. */}
            <PictureBox />
          </RoomCard>
        </View>

        <View style={{ paddingTop: 22, paddingHorizontal: 18, flexDirection: 'row', gap: 12 }}>
          <Button
            label="My hands"
            icon="grid"
            drop={0}
            bg={colors.marigold}
            style={{ flex: 1 }}
            onPress={() => router.push('/gallery')}
          />
          <IconButton
            icon="lock"
            iconSize={22}
            size={56}
            radius={16}
            accessibilityLabel="For grown-ups"
            onPress={() => router.push('/gate?next=/parents')}
          />
        </View>

        <Text
          style={{
            marginTop: 16,
            marginHorizontal: 28,
            textAlign: 'center',
            fontFamily: fonts.bodyBold,
            fontSize: 12.5,
            lineHeight: 18,
            color: colors.muted,
          }}
        >
          You can swap rooms any time — nothing is locked to an age.
        </Text>
      </ScrollView>
    </Screen>
  );
}
