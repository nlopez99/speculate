import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import ShowCard from '@/components/ShowCard';
import PredictionCard from '@/components/PredictionCard';
import { ScrollView, View, RefreshControl, ImageBackground, Animated } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Bell, TrendingUp, Zap } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pointsShimmer = useRef(new Animated.Value(0)).current;
  const userAccuracy = 89;
  const userPoints = '2.8k';

  useEffect(() => {
    // Shimmer animation for active predictions
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false, // Need false for color interpolation
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Shimmer animation for points
    Animated.loop(
      Animated.sequence([
        Animated.timing(pointsShimmer, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(pointsShimmer, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [shimmerAnim, pointsShimmer]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return '#34D399';
    if (accuracy >= 80) return '#60A5FA';
    if (accuracy >= 70) return '#FBBF24';
    return '#888';
  };

  // Mock data
  const trendingShows = [
    {
      id: 'sherlock',
      title: 'Sherlock',
      image: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=400&h=600&fit=crop',
      genre: 'Mystery',
      isFollowing: true,
      activePredictions: 12,
      totalFollowers: 1243,
      accuracy: 82,
      nextEpisode: {
        title: 'The Final Problem',
        airDate: 'Tonight 9PM',
      },
    },
    {
      id: 'westworld',
      title: 'Westworld',
      image: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=400&h=600&fit=crop',
      genre: 'Sci-Fi',
      isFollowing: false,
      activePredictions: 8,
      totalFollowers: 892,
      accuracy: 65,
      nextEpisode: {
        title: 'The Bicameral Mind',
        airDate: 'Tomorrow 10PM',
      },
    },
  ];

  const activePredictions: Array<{
    id: number;
    question: string;
    type: 'yes-no' | 'multiple-choice';
    status: 'open' | 'locked' | 'resolved';
    totalPredictions: number;
    timeLeft: string;
    show: string;
    votingData: { [key: string]: number };
    options?: string[];
    comments: number;
  }> = [
    {
      id: 1,
      question: 'Will the detective solve the case in the next episode?',
      type: 'yes-no',
      status: 'open',
      totalPredictions: 847,
      timeLeft: '2h 15m left',
      show: 'Sherlock',
      votingData: { Yes: 523, No: 324 },
      comments: 42,
    },
    {
      id: 2,
      question: 'Who will be revealed as the main antagonist?',
      type: 'multiple-choice',
      options: ['Character A', 'Character B', 'Character C', 'Someone new'],
      status: 'open',
      totalPredictions: 623,
      timeLeft: '5h 30m left',
      show: 'Westworld',
      votingData: { 'Character A': 156, 'Character B': 298, 'Character C': 87, 'Someone new': 82 },
      comments: 28,
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View className="flex-1 bg-background">
        {/* Fixed black bar for safe area */}
        <View style={{ height: insets.top, backgroundColor: '#0A0A0F' }} />

        <ScrollView
          className="flex-1 bg-background"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentInsetAdjustmentBehavior="automatic">
          {/* Hero Section */}
          <View className="relative mb-6">
            <ImageBackground
              source={require('@/assets/images/hero-image.jpg')}
              style={{ height: 192 }}
              resizeMode="cover">
              <LinearGradient
                colors={['transparent', 'rgba(10, 10, 15, 0.5)', 'rgba(10, 10, 15, 1)']}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
              />
              <View className="relative flex h-full items-center justify-end p-6">
                <Text className="mb-2 text-2xl font-bold text-foreground">Speculate</Text>
                <Text className="mb-4 text-center text-sm text-muted-foreground">
                  Predict plot twists. Discuss theories. Track your accuracy.
                </Text>
                <Button className="flex-row items-center justify-center bg-primary">
                  <Zap size={16} color="#ffffff" />
                  <Text className="font-bold text-secondary-foreground">
                    Make Your First Speculation
                  </Text>
                </Button>
              </View>
            </ImageBackground>
          </View>

          {/* Quick Stats */}
          <View className="mb-6 px-4">
            <View className="flex-row justify-around">
              <View>
                <Animated.Text
                  style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    marginBottom: 4,
                    color: shimmerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['#a855f7', '#c084fc'], // Purple to lighter purple
                    }),
                  }}>
                  12.4K
                </Animated.Text>
                <Text className="text-xs text-muted-foreground">Active Speculations</Text>
              </View>
              <View>
                <Text
                  className="text-xl font-bold"
                  style={{ color: getAccuracyColor(userAccuracy) }}>
                  {userAccuracy}%
                </Text>
                <Text className="text-xs text-muted-foreground">Your Accuracy</Text>
              </View>
              <View>
                <Animated.Text
                  style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    marginBottom: 4,
                    color: pointsShimmer.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['#a855f7', '#d8b4fe'], // Purple to very light purple
                    }),
                  }}>
                  {userPoints.toLocaleString()}
                </Animated.Text>
                <Text className="text-xs text-muted-foreground">Your Points</Text>
              </View>
            </View>
          </View>

          <View className="px-4 pb-24">
            {/* Trending Shows */}
            <View className="mb-8">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-xl font-semibold text-foreground">Trending Shows</Text>
                <Button variant="ghost" size="sm" onPress={() => router.push('/all-shows?type=trending')}>
                  <Text className="text-primary">See All</Text>
                </Button>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-4">
                  {trendingShows.map((show) => (
                    <View key={show.id} style={{ width: 280 }}>
                      <ShowCard {...show} />
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Active Speculations */}
            <View className="mb-8">
              <View className="mb-4 flex-row items-center gap-2">
                <TrendingUp size={20} color="#a855f7" />
                <Text className="text-xl font-semibold text-foreground">Hot Speculations</Text>
              </View>

              <View className="gap-4">
                {activePredictions.map((prediction) => (
                  <PredictionCard key={prediction.id} {...prediction} />
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
