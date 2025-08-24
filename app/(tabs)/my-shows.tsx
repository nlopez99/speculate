import { ScrollView, View, TextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import ShowCard from '@/components/ShowCard';
import { Search, Filter } from 'lucide-react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

export default function MyShowsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const myShows = [
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
      id: 'true-detective',
      title: 'True Detective',
      image: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop',
      genre: 'Crime',
      isFollowing: true,
      activePredictions: 5,
      totalFollowers: 756,
      accuracy: 71,
      nextEpisode: {
        title: 'Night Country',
        airDate: 'Sunday 9PM',
      },
    },
    {
      id: 'dark',
      title: 'Dark',
      image: 'https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=400&h=600&fit=crop',
      genre: 'Sci-Fi Mystery',
      isFollowing: true,
      activePredictions: 9,
      totalFollowers: 1892,
      accuracy: 68,
    },
  ];

  const recommendedShows = [
    {
      id: 'westworld',
      title: 'Westworld',
      image: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?w=400&h=600&fit=crop',
      genre: 'Sci-Fi',
      isFollowing: false,
      activePredictions: 8,
      totalFollowers: 892,
      accuracy: 65,
    },
    {
      id: 'mare-of-easttown',
      title: 'Mare of Easttown',
      image: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&h=600&fit=crop',
      genre: 'Mystery Drama',
      isFollowing: false,
      activePredictions: 4,
      totalFollowers: 432,
      accuracy: 73,
    },
  ];

  const filters = ['all', 'airing', 'upcoming', 'ended'];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Shows',
          headerRight: () => (
            <Button size="icon" variant="ghost" className="mr-4">
              <Filter size={20} color="#fff" />
            </Button>
          ),
        }}
      />
      <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
        <View className="px-4 py-6 pb-24">
          {/* Search Bar */}
          <View className="mb-6">
            <View className="flex-row items-center bg-card border border-border rounded-xl px-4">
              <Search size={20} color="#888" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search shows..."
                placeholderTextColor="#888"
                className="flex-1 py-3 px-3 text-foreground"
              />
            </View>
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            <View className="flex-row gap-2">
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                >
                  <View
                    className={`px-4 py-2 rounded-full ${
                      activeFilter === filter ? 'bg-primary' : 'bg-card border border-border'
                    }`}
                  >
                    <Text
                      className={`text-sm capitalize ${
                        activeFilter === filter ? 'text-primary-foreground font-semibold' : 'text-foreground'
                      }`}
                    >
                      {filter}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Following Shows */}
          <View className="mb-8">
            <View className="gap-4">
              {myShows.map((show) => (
                <ShowCard key={show.id} {...show} />
              ))}
            </View>
          </View>

          {/* Recommended Shows */}
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-semibold text-foreground">
                Recommended for You
              </Text>
              <Button variant="ghost" size="sm" onPress={() => router.push('/all-shows?type=recommended')}>
                <Text className="text-primary">See All</Text>
              </Button>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-4">
                {recommendedShows.map((show) => (
                  <View key={show.id} style={{ width: 280 }}>
                    <ShowCard {...show} />
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

// Add TouchableOpacity import
import { TouchableOpacity } from 'react-native';