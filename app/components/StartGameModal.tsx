'use client';

import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Modal,
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  InputAdornment,
  FormControl,
  InputLabel,
  OutlinedInput,
  FormHelperText,
  CircularProgress,
} from '@mui/material';

type StartGameModalProps = {
  open: boolean;
  onClose?: () => void;
  onSubmit?: (data: GameFormData) => void;
  isLoading?: boolean;
};

export type GameFormData = {
  gameType: string;
  wagerAmount: string;
  opponent: string;
};

const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const baseNameRegex = /^[a-zA-Z0-9-]+\.base\.eth$/;

const schema = yup.object().shape({
  gameType: yup.string().required('Game type is required'),
  wagerAmount: yup
    .string()
    .required('Wager amount is required')
    .test(
      'is-valid-number',
      'Wager amount must be a valid number',
      (value) => {
        if (!value) return false;
        return !isNaN(parseFloat(value)) && /^-?\d*\.?\d+$/.test(value);
      }
    )
    .test(
      'is-positive',
      'Wager amount must be positive',
      (value) => {
        if (!value) return false;
        return parseFloat(value) > 0;
      }
    )
    .test(
      'max-decimals',
      'Maximum 18 decimal places allowed',
      (value) => {
        if (!value) return true;
        const decimalPart = value.split('.')[1];
        return !decimalPart || decimalPart.length <= 18;
      }
    ),
  opponent: yup
    .string()
    .required('Opponent address is required')
    .test(
      'is-valid-address',
      'Must be a valid ETH address (0x...) or Base name (name.base.eth)',
      (value) => {
        if (!value) return false;
        return ethAddressRegex.test(value) || baseNameRegex.test(value);
      }
    ),
});

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  borderRadius: 2,
  boxShadow: 24,
  p: 4,
};

export default function StartGameModal({ open, onClose, onSubmit, isLoading = false }: StartGameModalProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<GameFormData>({
    resolver: yupResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      gameType: 'tictactoe',
      wagerAmount: '',
      opponent: '',
    },
  });

  const onFormSubmit = (data: GameFormData) => {
    onSubmit?.(data);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalStyle}>
        <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 600 }}>
          Start New Game
        </Typography>

        <form onSubmit={handleSubmit(onFormSubmit)}>
          <Controller
            name="gameType"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                fullWidth
                label="Game Type"
                disabled
                helperText="More games coming soon!"
                sx={{ mb: 3 }}
              >
                <MenuItem value="tictactoe">Tic Tac Toe</MenuItem>
              </TextField>
            )}
          />

          <Controller
            name="wagerAmount"
            control={control}
            render={({ field: { onChange, onBlur, value, ref } }) => (
              <TextField
                fullWidth
                label="Wager Amount"
                placeholder="0.00"
                value={value}
                onChange={(e) => {
                  const input = e.target.value;
                  // Only allow digits and one decimal point
                  const filtered = input
                    .replace(/[^0-9.]/g, '')
                    .replace(/(\..*)\./g, '$1');
                  onChange(filtered);
                }}
                onBlur={onBlur}
                inputRef={ref}
                error={!!errors.wagerAmount}
                helperText={errors.wagerAmount?.message}
                InputProps={{
                  startAdornment: <InputAdornment position="start">DUEL</InputAdornment>,
                }}
                sx={{ mb: 3 }}
              />
            )}
          />

          <Controller
            name="opponent"
            control={control}
            render={({ field }) => (
              <FormControl variant="outlined" fullWidth error={!!errors.opponent} sx={{ mb: 3 }}>
                <InputLabel htmlFor={field.name} shrink>Opponent</InputLabel>
                <OutlinedInput
                  {...field}
                  id={field.name}
                  label="Opponent"
                  notched
                  placeholder="0x... or name.base.eth"
                  aria-describedby={`${field.name}-helper-text`}
                />
                <FormHelperText id={`${field.name}-helper-text`}>
                  {errors.opponent?.message}
                </FormHelperText>
              </FormControl>
            )}
          />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            {onClose && (
              <Button variant="outlined" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
            )}
            <Button type="submit" variant="contained" disabled={isLoading}>
              {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Start Game'}
            </Button>
          </Box>
        </form>

        {/* Store Link */}
        <Box
          sx={{
            mt: 3,
            pt: 3,
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Need more DUEL tokens?
          </Typography>
          <Button
            href="/store"
            variant="text"
            sx={{
              color: 'warning.main',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: 'warning.light',
                color: 'warning.dark',
              },
            }}
            startIcon={<span>🪙</span>}
          >
            Visit the Token Store
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
