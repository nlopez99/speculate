import { ScrollView, View, TouchableOpacity, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Settings, Trophy, TrendingUp, Eye, Clock, Share, Edit, ChevronRight } from 'lucide-react-native';
import { Stack } from 'expo-router';

export default function ProfileScreen() {
  const userStats = {
    username: 'MysteryMaster',
    rank: 7,
    totalPredictions: 156,
    correctPredictions: 127,
    accuracy: 81,
    streak: 12,
    totalPoints: 2847,
    level: 'Detective',
  };

  const recentPredictions = [
    {
      show: 'Sherlock',
      question: 'Will Sherlock deduce Moriarty\'s plan?',
      answer: 'Yes',
      status: 'correct',
      points: 25,
      date: '2h ago',
    },
    {
      show: 'Westworld',
      question: 'Is Bernard a host?',
      answer: 'Yes',
      status: 'correct',
      points: 30,
      date: '1d ago',
    },
    {
      show: 'True Detective',
      question: 'Who is the Yellow King?',
      answer: 'Errol Childress',
      status: 'pending',
      points: 0,
      date: '3d ago',
    },
  ];

  const achievements = [
    { name: 'First Prediction', icon: '🎯', unlocked: true },
    { name: 'Perfect Week', icon: '🔥', unlocked: true },
    { name: 'Mystery Solver', icon: '🕵️', unlocked: true },
    { name: 'Prediction Master', icon: '👑', unlocked: false },
  ];

  const showStats = [
    { show: 'Sherlock', predictions: 15, accuracy: 92 },
    { show: 'Westworld', predictions: 23, accuracy: 78 },
    { show: 'True Detective', predictions: 8, accuracy: 65 },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Profile',
          headerRight: () => (
            <Button size="icon" variant="ghost" className="mr-4">
              <Settings size={20} color="#fff" />
            </Button>
          ),
        }}
      />
      <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
        <View className="px-4 py-6 pb-24">
          {/* Profile Header */}
          <View className="items-center mb-6">
            <View className="w-20 h-20 bg-primary/20 rounded-full items-center justify-center mb-3">
              <Text className="text-2xl font-bold text-primary">MM</Text>
            </View>
            
            <Text className="text-xl font-bold text-foreground">{userStats.username}</Text>
            
            <View className="bg-primary/20 px-3 py-1 rounded-full mt-2 flex-row items-center gap-1">
              <Trophy size={12} color="#a855f7" />
              <Text className="text-sm text-primary font-semibold">
                #{userStats.rank} {userStats.level}
              </Text>
            </View>

            <View className="flex-row gap-3 mt-4">
              <Button size="sm" variant="outline">
                <Edit size={16} color="#fff" />
                <Text className="ml-2">Edit Profile</Text>
              </Button>
              <Button size="sm" variant="outline">
                <Share size={16} color="#fff" />
                <Text className="ml-2">Share</Text>
              </Button>
            </View>
          </View>

          {/* Stats Grid */}
          <View className="flex-row flex-wrap gap-3 mb-6">
            <View className="flex-1 min-w-[45%] bg-card border border-border rounded-xl p-4 items-center">
              <Text className="text-2xl font-bold text-primary">{userStats.accuracy}%</Text>
              <Text className="text-sm text-muted-foreground">Accuracy</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-card border border-border rounded-xl p-4 items-center">
              <Text className="text-2xl font-bold text-primary">{userStats.streak}</Text>
              <Text className="text-sm text-muted-foreground">Day Streak</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-card border border-border rounded-xl p-4 items-center">
              <Text className="text-2xl font-bold text-primary">{userStats.totalPredictions}</Text>
              <Text className="text-sm text-muted-foreground">Predictions</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-card border border-border rounded-xl p-4 items-center">
              <Text className="text-2xl font-bold text-primary">{userStats.totalPoints}</Text>
              <Text className="text-sm text-muted-foreground">Points</Text>
            </View>
          </View>

          {/* Level Progress */}
          <View className="bg-card border border-border rounded-xl p-4 mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-medium text-foreground">Level Progress</Text>
              <View className="bg-secondary px-2 py-1 rounded">
                <Text className="text-xs">{userStats.level}</Text>
              </View>
            </View>
            <View className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
              <View className="h-full bg-primary" style={{ width: '72%' }} />
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">2,847 / 3,500 XP</Text>
              <Text className="text-xs text-muted-foreground">Next: Master Detective</Text>
            </View>
          </View>

          {/* Achievements */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Achievements</Text>
            
            <View className="flex-row flex-wrap gap-3">
              {achievements.map((achievement, index) => (
                <View
                  key={index}
                  className={`flex-1 min-w-[22%] max-w-[23%] aspect-square bg-card border rounded-xl p-2 items-center justify-center ${
                    achievement.unlocked ? 'border-border' : 'border-border/30 opacity-50'
                  }`}
                >
                  <Text className="text-2xl mb-1">{achievement.icon}</Text>
                  <Text className="text-[10px] text-center text-foreground">
                    {achievement.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Recent Activity */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-foreground">Recent Predictions</Text>
              <Button variant="ghost" size="sm">
                <Text className="text-primary">View All</Text>
              </Button>
            </View>
            
            <View className="gap-3">
              {recentPredictions.map((prediction, index) => (
                <View key={index} className="bg-card border border-border rounded-xl p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="font-medium text-sm text-foreground">
                          {prediction.show}
                        </Text>
                        <View
                          className={`px-2 py-0.5 rounded ${
                            prediction.status === 'correct' ? 'bg-green-500/20' :
                            prediction.status === 'incorrect' ? 'bg-red-500/20' :
                            'bg-secondary'
                          }`}
                        >
                          <Text className="text-[10px]">
                            {prediction.status === 'correct' ? '✓' :
                             prediction.status === 'incorrect' ? '✗' : '⏳'}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-sm text-muted-foreground mb-2" numberOfLines={2}>
                        {prediction.question}
                      </Text>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-1">
                          <Clock size={12} color="#888" />
                          <Text className="text-xs text-muted-foreground">{prediction.date}</Text>
                        </View>
                        {prediction.points > 0 && (
                          <View className="flex-row items-center gap-1">
                            <TrendingUp size={12} color="#a855f7" />
                            <Text className="text-xs text-primary">+{prediction.points} pts</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Show Stats */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">Show Stats</Text>
            
            <View className="gap-3">
              {showStats.map((stat, index) => (
                <TouchableOpacity key={index}>
                  <View className="bg-card border border-border rounded-xl p-3 flex-row items-center justify-between">
                    <View>
                      <Text className="font-medium text-foreground">{stat.show}</Text>
                      <Text className="text-sm text-muted-foreground">
                        {stat.predictions} predictions
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`text-sm font-medium ${
                          stat.accuracy >= 80 ? 'text-green-500' :
                          stat.accuracy >= 70 ? 'text-primary' :
                          'text-muted-foreground'
                        }`}
                      >
                        {stat.accuracy}%
                      </Text>
                      <Text className="text-xs text-muted-foreground">accuracy</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}