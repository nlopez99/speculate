import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import ShowCard from '@/components/ShowCard';
import PredictionCard from '@/components/PredictionCard';
import {
  ScrollView,
  View,
  RefreshControl,
  ImageBackground,
  Animated,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Zap, Flame } from 'lucide-react-native';
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
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});

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

  const handleSpeculationAnswer = (speculationId: number, answer: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [speculationId]: prev[speculationId] === answer ? '' : answer,
    }));
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

  // Trending shows with their hot speculations
  const trendingShowsSpeculations = [
    {
      showId: 'stranger-things',
      showTitle: 'Stranger Things',
      showImage:
        'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=400&h=200&fit=crop',
      genre: 'Sci-Fi',
      totalSpeculations: 2341,
      speculations: [
        {
          id: 101,
          question: 'Will Eleven regain her powers before the season finale?',
          type: 'yes-no' as const,
          status: 'open' as const,
          totalPredictions: 1532,
          timeLeft: '12h 30m left',
          votingData: { Yes: 1123, No: 409 },
          comments: 89,
        },
        {
          id: 102,
          question: 'Which character will sacrifice themselves to save Hawkins?',
          type: 'multiple-choice' as const,
          options: ['Steve', 'Nancy', 'Jonathan', 'No one dies'],
          status: 'open' as const,
          totalPredictions: 809,
          timeLeft: '1d 5h left',
          votingData: { Steve: 412, Nancy: 98, Jonathan: 67, 'No one dies': 232 },
          comments: 56,
        },
      ],
    },
    {
      showId: 'succession',
      showTitle: 'Succession',
      showImage:
        'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=200&fit=crop',
      genre: 'Drama',
      totalSpeculations: 1876,
      speculations: [
        {
          id: 201,
          question: 'Will Kendall successfully take over Waystar Royco?',
          type: 'yes-no' as const,
          status: 'open' as const,
          totalPredictions: 1245,
          timeLeft: '6h 45m left',
          votingData: { Yes: 456, No: 789 },
          comments: 123,
        },
        {
          id: 202,
          question: 'Who will betray Logan first?',
          type: 'multiple-choice' as const,
          options: ['Shiv', 'Roman', 'Tom', 'Greg'],
          status: 'open' as const,
          totalPredictions: 631,
          timeLeft: '8h left',
          votingData: { Shiv: 234, Roman: 189, Tom: 156, Greg: 52 },
          comments: 45,
        },
      ],
    },
    {
      showId: 'the-last-of-us',
      showTitle: 'The Last of Us',
      showImage:
        'https://images.unsplash.com/photo-1626278664285-f796b9ee7806?w=400&h=200&fit=crop',
      genre: 'Post-Apocalyptic',
      totalSpeculations: 1654,
      speculations: [
        {
          id: 301,
          question: 'Will Joel tell Ellie the truth about the Fireflies?',
          type: 'yes-no' as const,
          status: 'open' as const,
          totalPredictions: 987,
          timeLeft: '3h 20m left',
          votingData: { Yes: 234, No: 753 },
          comments: 67,
        },
      ],
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
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => router.push('/all-shows?type=trending')}>
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

            {/* Trending Shows with Speculations */}
            <View className="mb-8">
              <View className="mb-4 flex-row items-center gap-2">
                <Flame size={20} color="#f97316" />
                <Text className="text-xl font-semibold text-foreground">
                  Trending Shows & Speculations
                </Text>
              </View>

              <View className="gap-4">
                {trendingShowsSpeculations.map((show) => (
                  <View
                    key={show.showId}
                    className="overflow-hidden rounded-xl border border-border bg-card">
                    {/* Show Header */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => router.push(`/show/${show.showId}` as any)}>
                      <View className="relative">
                        <Image
                          source={{ uri: show.showImage }}
                          style={{ width: '100%', height: 120 }}
                          resizeMode="cover"
                        />
                        <View className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                        {/* Show Info Overlay */}
                        <View className="absolute bottom-0 left-0 right-0 p-3">
                          <View className="flex-row items-center justify-between">
                            <View>
                              <Text className="text-lg font-bold text-white">{show.showTitle}</Text>
                              <View className="mt-1 flex-row items-center gap-2">
                                <View className="rounded bg-primary/20 px-2 py-0.5">
                                  <Text className="text-[10px] text-white">{show.genre}</Text>
                                </View>
                                <Text className="text-xs text-white/80">
                                  {show.totalSpeculations} speculations
                                </Text>
                              </View>
                            </View>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => router.push(`/show/${show.showId}` as any)}>
                              <Text className="text-xs">View Show</Text>
                            </Button>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Speculations for this show */}
                    <View className="gap-3 p-3">
                      {show.speculations.map((speculation) => (
                        <View key={speculation.id} className="rounded-lg bg-secondary/20 p-3">
                          <Text className="mb-2 text-sm font-medium text-foreground">
                            {speculation.question}
                          </Text>

                          {/* Meta Info */}
                          <View className="mb-2 flex-row items-center gap-3">
                            <View className="flex-row items-center gap-1">
                              <TrendingUp size={10} color="#a855f7" />
                              <Text className="text-[10px] font-semibold text-primary">
                                {speculation.totalPredictions} speculations
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-1">
                              <Zap size={10} color="#f97316" />
                              <Text className="text-[10px] font-semibold text-orange-500">
                                {speculation.timeLeft}
                              </Text>
                            </View>
                          </View>

                          {/* Quick Vote Options */}
                          {speculation.type === 'yes-no' ? (
                            <View className="flex-row gap-2">
                              {['Yes', 'No'].map((option) => {
                                const selectedAnswer = selectedAnswers[speculation.id];
                                const isSelected = selectedAnswer === option;
                                const votes = speculation.votingData[option as 'Yes'] || 0;
                                const percentage = Math.round(
                                  (votes / speculation.totalPredictions) * 100
                                );

                                return (
                                  <TouchableOpacity
                                    key={option}
                                    className="flex-1"
                                    activeOpacity={0.7}
                                    onPress={() => handleSpeculationAnswer(speculation.id, option)}>
                                    <View
                                      className={`rounded-lg border p-2 ${
                                        isSelected
                                          ? 'border-primary bg-primary/10'
                                          : 'border-border bg-card'
                                      }`}>
                                      <Text
                                        className={`text-center text-xs font-medium ${
                                          isSelected ? 'text-primary' : 'text-foreground'
                                        }`}>
                                        {option}
                                      </Text>
                                      {selectedAnswer && (
                                        <View className="mt-1">
                                          <Text className="text-center text-[10px] text-muted-foreground">
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
                              {speculation.options?.map((option) => {
                                const selectedAnswer = selectedAnswers[speculation.id];
                                const isSelected = selectedAnswer === option;
                                const votes = speculation.votingData[option as 'Yes'] || 0;
                                const percentage = Math.round(
                                  (votes / speculation.totalPredictions) * 100
                                );

                                return (
                                  <TouchableOpacity
                                    key={option}
                                    activeOpacity={0.7}
                                    onPress={() => handleSpeculationAnswer(speculation.id, option)}>
                                    <View
                                      className={`rounded-lg border p-2 ${
                                        isSelected
                                          ? 'border-primary bg-primary/10'
                                          : 'border-border bg-card'
                                      }`}>
                                      <View className="flex-row items-center justify-between">
                                        <Text
                                          className={`flex-1 text-xs font-medium ${
                                            isSelected ? 'text-primary' : 'text-foreground'
                                          }`}>
                                          {option}
                                        </Text>
                                        {selectedAnswer && (
                                          <Text className="ml-2 text-[10px] text-muted-foreground">
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
                      ))}

                      {/* View All Link */}
                      <TouchableOpacity
                        onPress={() => router.push(`/show/${show.showId}` as any)}
                        className="pt-2">
                        <Text className="text-center text-xs text-primary">
                          View all {show.showTitle} speculations →
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}
