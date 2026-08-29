import * as React from 'react';
import { NumericFormat, type NumericFormatProps } from 'react-number-format';
import { Input } from '@/components/ui/input';

interface InputWithDecimalsProps extends Omit<NumericFormatProps, 'customInput'> {
  fixedDecimalScale?: boolean;
}

const InputWithDecimals = React.forwardRef<HTMLInputElement, InputWithDecimalsProps>(
  ({ decimalScale = 2, fixedDecimalScale = false, ...props }, ref) => {
    return (
      <NumericFormat
        {...props}
        decimalScale={decimalScale}
        fixedDecimalScale={fixedDecimalScale}
        decimalSeparator="."
        customInput={Input}
        getInputRef={ref}
        allowNegative={false}
        thousandSeparator=","
      />
    );
  }
);

InputWithDecimals.displayName = 'InputWithDecimals';

export { InputWithDecimals };
