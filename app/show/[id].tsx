import { ScrollView, View, Image, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Users, TrendingUp, ChevronRight, Calendar, Zap } from 'lucide-react-native';
import { useState } from 'react';
import PredictionCard from '@/components/PredictionCard';

export default function ShowScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(true);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(4);

  // Mock data for the show
  const show = {
    id: id as string,
    title: 'Sherlock',
    image: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=800&h=400&fit=crop',
    genre: 'Mystery',
    description: 'A modern update finds the famous sleuth and his doctor partner solving crime in 21st century London.',
    rating: 9.1,
    year: '2010-2017',
    totalSeasons: 4,
    totalEpisodes: 13,
    totalPredictions: 3847,
    totalFollowers: 12450,
    communityAccuracy: 72,
  };

  const seasons = [
    {
      season: 4,
      episodes: [
        { id: 's4e1', number: 1, title: 'The Six Thatchers', airDate: 'Jan 1', predictions: 12, status: 'aired' },
        { id: 's4e2', number: 2, title: 'The Lying Detective', airDate: 'Jan 8', predictions: 15, status: 'aired' },
        { id: 's4e3', number: 3, title: 'The Final Problem', airDate: 'Tonight 9PM', predictions: 23, status: 'upcoming' },
      ],
    },
    {
      season: 3,
      episodes: [
        { id: 's3e1', number: 1, title: 'The Empty Hearse', predictions: 8, status: 'aired' },
        { id: 's3e2', number: 2, title: 'The Sign of Three', predictions: 10, status: 'aired' },
        { id: 's3e3', number: 3, title: 'His Last Vow', predictions: 11, status: 'aired' },
      ],
    },
  ];

  const topPredictors = [
    { username: 'DetectiveFan92', accuracy: 92, speculations: 45 },
    { username: 'SherlockHolmes221', accuracy: 88, speculations: 38 },
    { username: 'MysteryMaster', accuracy: 85, speculations: 42 },
  ];

  // Mock data for hot predictions
  const hotPredictions = [
    {
      id: 1,
      question: 'Will Moriarty make an appearance in the final episode?',
      type: 'yes-no' as const,
      status: 'open' as const,
      totalPredictions: 1247,
      timeLeft: '2h 15m left',
      votingData: { Yes: 823, No: 424 },
      comments: 89,
    },
    {
      id: 2,
      question: 'Who will be revealed as the true mastermind?',
      type: 'multiple-choice' as const,
      options: ['Moriarty', 'Mycroft', 'Mary Watson', 'Someone new'],
      status: 'open' as const,
      totalPredictions: 892,
      timeLeft: '5h 30m left',
      votingData: { 'Moriarty': 356, 'Mycroft': 198, 'Mary Watson': 247, 'Someone new': 91 },
      comments: 56,
    },
    {
      id: 3,
      question: 'Will John forgive Sherlock by the end of the episode?',
      type: 'yes-no' as const,
      status: 'open' as const,
      totalPredictions: 567,
      timeLeft: '1h 45m left',
      votingData: { Yes: 412, No: 155 },
      comments: 23,
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: show.title,
        }}
      />
      <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
        {/* Hero Image */}
        <View className="relative">
          <Image
            source={{ uri: show.image }}
            style={{ width: '100%', height: 200 }}
            resizeMode="cover"
          />
          <View className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          {/* Show Info Overlay */}
          <View className="absolute bottom-0 left-0 right-0 p-4">
            <Text className="text-2xl font-bold text-white mb-1">{show.title}</Text>
            <View className="flex-row items-center gap-3">
              <View className="bg-primary/20 px-2 py-1 rounded">
                <Text className="text-xs text-white">{show.genre}</Text>
              </View>
              <Text className="text-sm text-white/80">{show.year}</Text>
              <Text className="text-sm text-white/80">⭐ {show.rating}</Text>
            </View>
          </View>
        </View>

        <View className="px-4 py-6">
          {/* Description */}
          <Text className="text-muted-foreground mb-6 leading-5">
            {show.description}
          </Text>

          {/* Follow Button */}
          <Button
            onPress={() => setIsFollowing(!isFollowing)}
            className={`w-full mb-6 ${isFollowing ? 'bg-secondary' : 'bg-primary'}`}
          >
            <Text className={isFollowing ? 'text-foreground' : 'text-primary-foreground'}>
              {isFollowing ? 'Following' : 'Follow Show'}
            </Text>
          </Button>

          {/* Stats */}
          <View className="flex-row gap-3 mb-8">
            <View className="flex-1 bg-card border border-border rounded-xl p-4 items-center">
              <TrendingUp size={20} color="#a855f7" />
              <Text className="text-lg font-bold text-foreground mt-2">
                {show.totalPredictions}
              </Text>
              <Text className="text-xs text-muted-foreground">Speculations</Text>
            </View>
            <View className="flex-1 bg-card border border-border rounded-xl p-4 items-center">
              <Users size={20} color="#a855f7" />
              <Text className="text-lg font-bold text-foreground mt-2">
                {(show.totalFollowers / 1000).toFixed(1)}K
              </Text>
              <Text className="text-xs text-muted-foreground">Followers</Text>
            </View>
            <View className="flex-1 bg-card border border-border rounded-xl p-4 items-center">
              <Text className="text-xl">🎯</Text>
              <Text className="text-lg font-bold text-foreground mt-2">
                {show.communityAccuracy}%
              </Text>
              <Text className="text-xs text-muted-foreground">Accuracy</Text>
            </View>
          </View>

          {/* Top Speculators */}
          <View className="mb-8">
            <Text className="text-lg font-semibold text-foreground mb-4">Top Speculators</Text>
            
            <View className="gap-3">
              {topPredictors.map((predictor, index) => (
                <View key={index} className="bg-card border border-border rounded-xl p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center">
                        <Text className="font-bold text-primary">
                          {index + 1}
                        </Text>
                      </View>
                      <View>
                        <Text className="font-medium text-foreground">
                          {predictor.username}
                        </Text>
                        <Text className="text-sm text-muted-foreground">
                          {predictor.speculations} speculations
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-lg font-bold text-primary">
                        {predictor.accuracy}%
                      </Text>
                      <Text className="text-xs text-muted-foreground">accuracy</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Hot Predictions */}
          <View className="mb-8">
            <View className="flex-row items-center gap-2 mb-4">
              <Zap size={20} color="#a855f7" />
              <Text className="text-lg font-semibold text-foreground">Hot Speculations</Text>
            </View>
            
            <View className="gap-4">
              {hotPredictions.map((prediction) => (
                <PredictionCard key={prediction.id} {...prediction} />
              ))}
            </View>
            
            <Button variant="outline" className="mt-4 w-full">
              <Text className="text-primary">View All Speculations</Text>
            </Button>
          </View>

          {/* Episodes */}
          <View>
            <Text className="text-lg font-semibold text-foreground mb-4">Episodes</Text>
            
            {seasons.map((season) => (
              <View key={season.season} className="mb-4">
                <TouchableOpacity
                  onPress={() => setExpandedSeason(
                    expandedSeason === season.season ? null : season.season
                  )}
                >
                  <View className="bg-card border border-border rounded-xl p-4 flex-row items-center justify-between">
                    <Text className="font-medium text-foreground">
                      Season {season.season}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm text-muted-foreground">
                        {season.episodes.length} episodes
                      </Text>
                      <ChevronRight
                        size={16}
                        color="#888"
                        style={{
                          transform: [{ rotate: expandedSeason === season.season ? '90deg' : '0deg' }],
                        }}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {expandedSeason === season.season && (
                  <View className="mt-2 gap-2">
                    {season.episodes.map((episode) => (
                      <TouchableOpacity
                        key={episode.id}
                        onPress={() => router.push(`/episode/${episode.id}` as any)}
                      >
                        <View className="bg-card/50 border border-border/50 rounded-lg p-3 ml-4">
                          <View className="flex-row items-start justify-between">
                            <View className="flex-1">
                              <Text className="font-medium text-foreground text-sm">
                                {episode.number}. {episode.title}
                              </Text>
                              {'airDate' in episode && episode.airDate && (
                                <View className="flex-row items-center gap-1 mt-1">
                                  <Calendar size={10} color="#888" />
                                  <Text className="text-xs text-muted-foreground">
                                    {'airDate' in episode ? episode.airDate : ''}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View className="flex-row items-center gap-2">
                              {episode.predictions > 0 && (
                                <View className="bg-primary/10 px-2 py-1 rounded">
                                  <Text className="text-xs text-primary">
                                    {episode.predictions} speculations
                                  </Text>
                                </View>
                              )}
                              {episode.status === 'upcoming' && (
                                <View className="bg-green-500/20 px-2 py-1 rounded">
                                  <Text className="text-xs text-green-500">Live</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}