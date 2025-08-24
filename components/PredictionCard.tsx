import { View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { CheckCircle, XCircle, Clock, Users, MessageCircle, TrendingUp } from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';

interface PredictionCardProps {
  question: string;
  type: 'yes-no' | 'multiple-choice';
  options?: string[];
  status: 'open' | 'locked' | 'resolved';
  userAnswer?: string;
  correctAnswer?: string;
  accuracy?: number;
  totalPredictions?: number;
  timeLeft?: string;
  show?: string;
  votingData?: { [key: string]: number }; // New prop for voting totals
  endTime?: Date; // For calculating real-time countdown
  comments?: number; // Number of comments
}

export default function PredictionCard({
  question,
  type,
  options,
  status,
  userAnswer,
  correctAnswer,
  accuracy,
  totalPredictions,
  timeLeft,
  show,
  votingData,
  endTime,
  comments = 0,
}: PredictionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | undefined>(userAnswer);
  const [countdown, setCountdown] = useState<string>('');
  const targetTimeRef = useRef<Date | null>(null);
  const isCorrect = selectedAnswer === correctAnswer;

  // Mock point calculation based on various factors
  const calculatePoints = () => {
    if (!selectedAnswer || status !== 'open') return 0;
    
    // Base points
    let points = 50;
    
    // Add bonus for early prediction (based on time left)
    if (countdown) {
      const hoursMatch = countdown.match(/(\d+)h/);
      if (hoursMatch && parseInt(hoursMatch[1]) > 24) {
        points += 30; // Early bird bonus
      } else if (hoursMatch && parseInt(hoursMatch[1]) > 12) {
        points += 20;
      } else if (hoursMatch && parseInt(hoursMatch[1]) > 6) {
        points += 10;
      }
    }
    
    // Add difficulty bonus (less popular choice = more points)
    if (votingData && selectedAnswer) {
      const percentage = calculatePercentage(selectedAnswer);
      if (percentage < 20) {
        points += 40; // Contrarian bonus
      } else if (percentage < 40) {
        points += 20;
      }
    }
    
    return points;
  };

  // Real-time countdown effect
  useEffect(() => {
    if (status !== 'open') return;

    // Only set target time once on mount or when timeLeft changes
    if (!targetTimeRef.current) {
      if (endTime) {
        targetTimeRef.current = new Date(endTime);
      } else if (timeLeft) {
        // Parse the timeLeft string (e.g., "2h 15m left")
        const hoursMatch = timeLeft.match(/(\d+)h/);
        const minutesMatch = timeLeft.match(/(\d+)m/);
        
        let totalMilliseconds = 0;
        if (hoursMatch) {
          totalMilliseconds += parseInt(hoursMatch[1]) * 3600000;
        }
        if (minutesMatch) {
          totalMilliseconds += parseInt(minutesMatch[1]) * 60000;
        }
        
        if (totalMilliseconds > 0) {
          targetTimeRef.current = new Date(Date.now() + totalMilliseconds);
        }
      }
    }

    if (!targetTimeRef.current) {
      setCountdown(timeLeft || '');
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetTimeRef.current!.getTime() - now;

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        if (hours > 0) {
          setCountdown(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setCountdown(`${minutes}m ${seconds}s`);
        } else {
          setCountdown(`${seconds}s`);
        }
      } else {
        setCountdown('Ended');
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [status]); // Only depend on status, not timeLeft

  const handleAnswer = (answer: string) => {
    if (status === 'open') {
      setSelectedAnswer(selectedAnswer === answer ? undefined : answer);
    }
  };

  // Calculate percentages for voting display
  const calculatePercentage = (option: string) => {
    if (!votingData) return 0;
    const total = Object.values(votingData).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    return Math.round(((votingData[option] || 0) / total) * 100);
  };

  return (
    <TouchableOpacity activeOpacity={0.7}>
      <View className="gap-4 rounded-xl border border-border/50 bg-card p-4">
        {/* Status Badge at Top */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            {show && <Text className="mb-1 text-xs font-medium text-primary">{show}</Text>}
            <Text className="font-semibold text-foreground">{question}</Text>
          </View>
        </View>

        {/* Meta Info */}
        <View className="flex-row items-center gap-4">
          {status === 'open' && (countdown || timeLeft) && (
            <View className="flex-row items-center gap-1">
              <Clock size={12} color="#a855f7" />
              <Text className="text-xs font-semibold text-primary">
                {countdown || timeLeft}
              </Text>
            </View>
          )}

          {totalPredictions && (
            <View className="flex-row items-center gap-1">
              <Users size={12} color="#888" />
              <Text className="text-xs text-muted-foreground">{totalPredictions} speculations</Text>
            </View>
          )}

          <TouchableOpacity className="flex-row items-center gap-1">
            <MessageCircle size={12} color="#888" />
            <Text className="text-xs text-muted-foreground">{comments} comments</Text>
          </TouchableOpacity>

          {status === 'resolved' && accuracy && (
            <View className="rounded bg-secondary px-2 py-1">
              <Text className="text-xs">{accuracy}% got this right</Text>
            </View>
          )}
        </View>

        {/* Options with Voting Totals */}
        <View>
          {type === 'yes-no' ? (
            <View className="flex-row gap-2">
              {['Yes', 'No'].map((option) => {
                const percentage = calculatePercentage(option);
                const votes = votingData?.[option] || 0;

                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => handleAnswer(option)}
                    disabled={status !== 'open'}
                    className="flex-1">
                    <View
                      className={`rounded-lg border p-3 ${selectedAnswer === option ? 'border-primary bg-primary/10' : 'border-border'} ${status === 'resolved' && correctAnswer === option ? 'border-green-500 bg-green-500/20' : ''} ${status === 'resolved' && selectedAnswer === option && selectedAnswer !== correctAnswer ? 'border-red-500 bg-red-500/20' : ''} `}>
                      <Text
                        className={`text-center ${selectedAnswer === option ? 'font-semibold text-primary' : 'text-foreground'}`}>
                        {option}
                      </Text>
                      {votingData && selectedAnswer && (
                        <View className="mt-2">
                          <Text className="text-center text-xs text-muted-foreground">
                            {percentage}% ({votes})
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="gap-2">
              {options?.map((option) => {
                const percentage = calculatePercentage(option);
                const votes = votingData?.[option] || 0;

                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => handleAnswer(option)}
                    disabled={status !== 'open'}>
                    <View
                      className={`rounded-lg border p-3 ${selectedAnswer === option ? 'border-primary bg-primary/10' : 'border-border'} ${status === 'resolved' && correctAnswer === option ? 'border-green-500 bg-green-500/20' : ''} ${status === 'resolved' && selectedAnswer === option && selectedAnswer !== correctAnswer ? 'border-red-500 bg-red-500/20' : ''} `}>
                      <View className="flex-row items-center justify-between">
                        <Text
                          className={`flex-1 ${selectedAnswer === option ? 'font-semibold text-primary' : 'text-foreground'}`}>
                          {option}
                        </Text>
                        {votingData && selectedAnswer && (
                          <Text className="ml-2 text-xs text-muted-foreground">
                            {percentage}% ({votes})
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Points Indicator - Shows when user has selected an answer */}
        {selectedAnswer && status === 'open' && (
          <View className="rounded-lg bg-primary/10 border border-primary/20 p-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <TrendingUp size={16} color="#a855f7" />
                <Text className="text-sm font-medium text-foreground">
                  Potential Points
                </Text>
              </View>
              <Text className="text-lg font-bold text-primary">
                +{calculatePoints()} pts
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground mt-1">
              If your prediction is correct
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
