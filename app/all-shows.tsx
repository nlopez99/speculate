import { ScrollView, View, TextInput, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import ShowCard from '@/components/ShowCard';
import { Search, Filter, ArrowLeft } from 'lucide-react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

export default function AllShowsScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Mock data - in production this would come from an API
  const allShows = [
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
    {
      id: 'breaking-bad',
      title: 'Breaking Bad',
      image: 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=400&h=600&fit=crop',
      genre: 'Crime Drama',
      isFollowing: false,
      activePredictions: 15,
      totalFollowers: 3421,
      accuracy: 79,
    },
    {
      id: 'stranger-things',
      title: 'Stranger Things',
      image: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=400&h=600&fit=crop',
      genre: 'Sci-Fi Horror',
      isFollowing: true,
      activePredictions: 18,
      totalFollowers: 5632,
      accuracy: 74,
    },
    {
      id: 'the-wire',
      title: 'The Wire',
      image: 'https://images.unsplash.com/photo-1481833761820-0509d3217039?w=400&h=600&fit=crop',
      genre: 'Crime Drama',
      isFollowing: false,
      activePredictions: 7,
      totalFollowers: 1876,
      accuracy: 81,
    },
  ];

  const filters = ['all', 'trending', 'new', 'ending soon'];
  
  const getTitle = () => {
    if (type === 'trending') return 'Trending Shows';
    if (type === 'recommended') return 'Recommended Shows';
    return 'All Shows';
  };

  const getFilteredShows = () => {
    let shows = [...allShows];
    
    // Filter by type
    if (type === 'trending') {
      shows = shows.sort((a, b) => b.activePredictions - a.activePredictions);
    } else if (type === 'recommended') {
      shows = shows.filter(show => !show.isFollowing);
    }
    
    // Filter by search query
    if (searchQuery) {
      shows = shows.filter(show => 
        show.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        show.genre.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filter by active filter
    if (activeFilter === 'trending') {
      shows = shows.sort((a, b) => b.totalFollowers - a.totalFollowers);
    } else if (activeFilter === 'new') {
      // In production, this would filter by actual air date
      shows = shows.slice(0, 4);
    } else if (activeFilter === 'ending soon') {
      // In production, this would filter by shows ending soon
      shows = shows.filter(show => show.nextEpisode);
    }
    
    return shows;
  };

  const filteredShows = getFilteredShows();

  return (
    <>
      <Stack.Screen
        options={{
          title: getTitle(),
          headerLeft: () => (
            <Button size="icon" variant="ghost" onPress={() => router.back()} className="ml-4">
              <ArrowLeft size={20} color="#fff" />
            </Button>
          ),
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

          {/* Results Count */}
          <Text className="text-sm text-muted-foreground mb-4">
            {filteredShows.length} shows found
          </Text>

          {/* Shows Grid */}
          <View className="gap-4">
            {filteredShows.map((show) => (
              <ShowCard key={show.id} {...show} />
            ))}
          </View>

          {filteredShows.length === 0 && (
            <View className="items-center justify-center py-12">
              <Text className="text-muted-foreground mb-2">No shows found</Text>
              <Text className="text-sm text-muted-foreground">Try adjusting your filters</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}