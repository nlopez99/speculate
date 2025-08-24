import { ScrollView, View, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Trophy, Crown, Medal, Target, TrendingUp, Star } from 'lucide-react-native';
import { Stack } from 'expo-router';

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<'all-time' | 'weekly'>('all-time');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const topPredictors = [
    {
      rank: 1,
      username: 'MysteryMaster',
      accuracy: 94,
      totalPredictions: 247,
      streak: 12,
      avatar: 'MM',
      topShow: 'Sherlock Holmes',
      badge: 'Detective',
      points: 2840
    },
    {
      rank: 2,
      username: 'PlotTwister',
      accuracy: 91,
      totalPredictions: 198,
      streak: 8,
      avatar: 'PT',
      topShow: 'True Detective',
      badge: 'Investigator',
      points: 2650
    },
    {
      rank: 3,
      username: 'ClueHunter',
      accuracy: 89,
      totalPredictions: 312,
      streak: 15,
      avatar: 'CH',
      topShow: 'Westworld',
      badge: 'Analyst',
      points: 2480
    },
    {
      rank: 4,
      username: 'DeductionKing',
      accuracy: 87,
      totalPredictions: 156,
      streak: 6,
      avatar: 'DK',
      topShow: 'Mindhunter',
      badge: 'Sleuth',
      points: 2120
    },
    {
      rank: 5,
      username: 'TheoryMachine',
      accuracy: 85,
      totalPredictions: 203,
      streak: 9,
      avatar: 'TM',
      topShow: 'Mare of Easttown',
      badge: 'Theorist',
      points: 1980
    },
    {
      rank: 6,
      username: 'SherlockFan',
      accuracy: 92,
      totalPredictions: 89,
      streak: 7,
      avatar: 'SF',
      topShow: 'Sherlock Holmes',
      badge: 'Expert',
      points: 1850
    },
    {
      rank: 7,
      username: 'WestworldGenius',
      accuracy: 88,
      totalPredictions: 145,
      streak: 11,
      avatar: 'WG',
      topShow: 'Westworld',
      badge: 'AI Predictor',
      points: 1720
    },
    {
      rank: 8,
      username: 'TrueDetectivePro',
      accuracy: 86,
      totalPredictions: 167,
      streak: 4,
      avatar: 'TD',
      topShow: 'True Detective',
      badge: 'Investigator',
      points: 1650
    },
    {
      rank: 9,
      username: 'MindhunterAce',
      accuracy: 84,
      totalPredictions: 134,
      streak: 6,
      avatar: 'MA',
      topShow: 'Mindhunter',
      badge: 'Profiler',
      points: 1580
    },
    {
      rank: 10,
      username: 'EasttownExpert',
      accuracy: 83,
      totalPredictions: 98,
      streak: 5,
      avatar: 'EE',
      topShow: 'Mare of Easttown',
      badge: 'Local Detective',
      points: 1420
    }
  ];

  const weeklyLeaders = [
    { username: 'NewSleuth', points: 180, change: '+23' },
    { username: 'MysteryMaster', points: 165, change: '+12' },
    { username: 'ClueSeeker', points: 142, change: '+35' },
    { username: 'PlotTwister', points: 138, change: '+8' },
    { username: 'DeductionPro', points: 127, change: '+19' }
  ];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown size={24} color="#EAB308" />;
      case 2:
        return <Medal size={24} color="#9CA3AF" />;
      case 3:
        return <Trophy size={24} color="#D97706" />;
      default:
        return <Target size={20} color="#888" />;
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return '#34D399';
    if (accuracy >= 80) return '#60A5FA';
    if (accuracy >= 70) return '#FBBF24';
    return '#888';
  };

  // Get top 3 for podium
  const podiumUsers = topPredictors.slice(0, 3);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Leaderboard',
        }}
      />
      <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
        <View className="p-6 pb-24">
          {/* Header */}
          <View className="items-center mb-6">
            <View className="flex-row items-center gap-2 mb-2">
              <Trophy size={32} color="#a855f7" />
              <Text className="text-3xl font-bold text-primary">
                Leaderboard
              </Text>
            </View>
            <Text className="text-muted-foreground">
              Top mystery solvers in the community
            </Text>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-2 mb-6">
            <TouchableOpacity
              onPress={() => setActiveTab('all-time')}
              className={`flex-1 py-3 rounded-xl ${activeTab === 'all-time' ? 'bg-primary' : 'bg-card border border-border'}`}
            >
              <View className="flex-row items-center justify-center gap-2">
                <Star size={16} color={activeTab === 'all-time' ? '#0A0A0F' : '#fff'} />
                <Text className={activeTab === 'all-time' ? 'text-primary-foreground font-medium' : 'text-foreground'}>
                  All Time
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('weekly')}
              className={`flex-1 py-3 rounded-xl ${activeTab === 'weekly' ? 'bg-primary' : 'bg-card border border-border'}`}
            >
              <View className="flex-row items-center justify-center gap-2">
                <TrendingUp size={16} color={activeTab === 'weekly' ? '#0A0A0F' : '#fff'} />
                <Text className={activeTab === 'weekly' ? 'text-primary-foreground font-medium' : 'text-foreground'}>
                  This Week
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {activeTab === 'all-time' ? (
            <>
              {/* Top 3 Podium */}
              <View className="mb-6">
                {podiumUsers.map((user, index) => (
                  <View
                    key={user.username}
                    className={`bg-card rounded-xl p-4 mb-3 ${
                      index === 0 ? 'border-2 border-yellow-500/30' : 'border border-border'
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="items-center justify-center">
                        {getRankIcon(user.rank)}
                      </View>
                      <View className="w-14 h-14 bg-primary rounded-full items-center justify-center">
                        <Text className="text-primary-foreground font-bold text-lg">{user.avatar}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="font-bold text-lg text-foreground">
                          {user.username}
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-2xl font-bold" style={{ color: getAccuracyColor(user.accuracy) }}>
                            {user.accuracy}%
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            • {user.totalPredictions} predictions
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View className="flex-row justify-between mt-3 pt-3 border-t border-border/50">
                      <Text className="text-sm text-muted-foreground">
                        Best at: <Text className="text-foreground">{user.topShow}</Text>
                      </Text>
                      <Text className="text-sm text-primary font-medium">
                        {user.points.toLocaleString()} pts
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Full Rankings */}
              <View className="gap-2">
                {topPredictors.slice(3).map((user) => (
                      <TouchableOpacity 
                        key={user.username} 
                        className="bg-card border border-border rounded-xl p-3"
                        onPress={() => setExpandedCard(expandedCard === user.rank ? null : user.rank)}
                        activeOpacity={0.7}
                      >
                        <View className="flex-row items-center gap-3">
                          <Text className="text-sm font-bold text-muted-foreground w-6 text-center">
                            {user.rank}
                          </Text>
                          
                          <View className="w-8 h-8 bg-primary rounded-full items-center justify-center">
                            <Text className="text-primary-foreground font-bold text-xs">{user.avatar}</Text>
                          </View>
                          
                          <View className="flex-1">
                            <Text className="font-semibold text-foreground">{user.username}</Text>
                          </View>
                          
                          <Text className="text-lg font-bold" style={{ color: getAccuracyColor(user.accuracy) }}>
                            {user.accuracy}%
                          </Text>
                        </View>
                        
                        {expandedCard === user.rank && (
                          <View className="mt-3 pt-3 border-t border-border/30">
                            <View className="flex-row justify-between mb-2">
                              <Text className="text-sm text-muted-foreground">Total Predictions</Text>
                              <Text className="text-sm text-foreground font-medium">{user.totalPredictions}</Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                              <Text className="text-sm text-muted-foreground">Current Streak</Text>
                              <Text className="text-sm text-foreground font-medium">🔥 {user.streak} days</Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                              <Text className="text-sm text-muted-foreground">Best Show</Text>
                              <Text className="text-sm text-foreground font-medium">{user.topShow}</Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                              <Text className="text-sm text-muted-foreground">Badge</Text>
                              <Text className="text-sm text-primary font-medium">🏅 {user.badge}</Text>
                            </View>
                            <View className="flex-row justify-between">
                              <Text className="text-sm text-muted-foreground">Total Points</Text>
                              <Text className="text-sm text-primary font-bold">{user.points.toLocaleString()} pts</Text>
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
            </>
          ) : (
            /* Weekly Tab */
            <View className="gap-3">
              {weeklyLeaders.map((user, index) => (
                <View key={user.username} className="bg-card border border-border rounded-xl p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4">
                      <View className="w-8 h-8 bg-secondary rounded-full items-center justify-center">
                        <Text className="text-sm font-bold text-foreground">#{index + 1}</Text>
                      </View>
                      <View className="w-10 h-10 bg-primary rounded-full items-center justify-center">
                        <Text className="text-primary-foreground font-bold">
                          {user.username.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text className="font-semibold text-foreground">{user.username}</Text>
                        <Text className="text-sm text-muted-foreground">
                          {user.points} points this week
                        </Text>
                      </View>
                    </View>
                    
                    <View className="bg-green-500/20 border border-green-500/30 px-2 py-1 rounded">
                      <Text className="text-xs text-green-500 font-medium">{user.change}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}