import { useEffect, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cleanDecimalText, decimalOf, decimalTextFollows } from './decimalText';

type DecimalInputProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> & { value: number | null; onValue: (value: number | null) => void };

/** A decimal field that keeps «3.» while typing; comma or dot both work. */
export function DecimalInput({ value, onValue, ...rest }: DecimalInputProps) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    setText((typed) => decimalTextFollows(typed, value));
  }, [value]);
  const change = (typed: string) => {
    const cleaned = cleanDecimalText(typed);
    setText(cleaned);
    onValue(decimalOf(cleaned));
  };
  return <TextInput {...rest} keyboardType="decimal-pad" value={text} onChangeText={change} />;
}
