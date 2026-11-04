import type { RefObject } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

/**
 * SIX BOXES, as the design draws them. One input with letter-spacing looks alike
 * from afar but does not show which digit comes next. The real input is invisible
 * and takes the keyboard; the boxes only draw it.
 */
export function OtpBoxes({ code, inputRef, onChange }: { code: string; inputRef: RefObject<TextInput | null>; onChange: (next: string) => void }) {
  return (
    <>
      <Pressable testID="cajas-otp" onPress={() => inputRef.current?.focus()} className="mt-8 flex-row justify-between">
        {Array.from({ length: 6 }, (_unused, index) => {
          const digit = code[index] ?? '';
          const active = index === code.length;
          return (
            <View
              key={index}
              testID={`otp-caja-${index}`}
              className={`h-14 w-[46px] items-center justify-center rounded-lg border bg-surface ${
                active ? 'border-primary' : digit ? 'border-outline/40' : 'border-outline/20'
              }`}
            >
              <Text className="text-2xl font-semibold text-on-surface">{digit}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={inputRef}
        testID="input-otp"
        className="absolute h-px w-px opacity-0"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        onChangeText={onChange}
      />
    </>
  );
}
