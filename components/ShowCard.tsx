import { View, Image, TouchableOpacity } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Eye, Users, TrendingUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface ShowCardProps {
  id: string;
  title: string;
  image: string;
  genre: string;
  isFollowing?: boolean;
  activePredictions?: number;
  totalFollowers?: number;
  accuracy?: number;
  nextEpisode?: {
    title: string;
    airDate: string;
  };
}

export default function ShowCard({
  id,
  title,
  image,
  genre,
  isFollowing,
  activePredictions,
  totalFollowers,
  accuracy,
  nextEpisode,
}: ShowCardProps) {
  const router = useRouter();

  return (
    <View className="bg-card rounded-xl overflow-hidden border border-border/50">
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push(`/show/${id}` as any)}
      >
        <View className="relative">
          <Image
            source={{ uri: image }}
            style={{ width: '100%', height: 280 }}
            resizeMode="cover"
          />
          <View className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          
          {/* Overlay Content */}
          <View className="absolute bottom-0 left-0 right-0 p-3">
            <View className="flex-row items-center justify-between">
              <View className="bg-secondary/80 px-2 py-1 rounded">
                <Text className="text-xs text-foreground">{genre}</Text>
              </View>
              
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View className="p-4 gap-3">
        <TouchableOpacity onPress={() => router.push(`/show/${id}` as any)}>
          <Text className="font-bold text-foreground text-base">{title}</Text>
        </TouchableOpacity>
        
        {nextEpisode && (
          <Text className="text-sm text-muted-foreground">
            Next: {nextEpisode.title} • {nextEpisode.airDate}
          </Text>
        )}

        {/* Stats */}
        <View className="flex-row gap-4">
          {activePredictions !== undefined && (
            <View className="flex-row items-center gap-1">
              <TrendingUp size={12} color="#888" />
              <Text className="text-xs text-muted-foreground">{activePredictions}</Text>
            </View>
          )}
          
          {totalFollowers !== undefined && (
            <View className="flex-row items-center gap-1">
              <Users size={12} color="#888" />
              <Text className="text-xs text-muted-foreground">{totalFollowers}</Text>
            </View>
          )}
          
          {accuracy !== undefined && (
            <View className="flex-row items-center gap-1">
              <Eye size={12} color="#888" />
              <Text className="text-xs text-muted-foreground">{accuracy}%</Text>
            </View>
          )}
        </View>

        {/* Action Button */}
        <Button
          variant={isFollowing ? 'secondary' : 'default'}
          size="sm"
          className="w-full"
        >
          <Text>{isFollowing ? 'Following' : 'Follow Show'}</Text>
        </Button>
      </View>
    </View>
  );
}