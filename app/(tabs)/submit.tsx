import { ScrollView, View, TextInput, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Search, Plus, ChevronRight, Zap, Clock } from 'lucide-react-native';
import { Stack } from 'expo-router';
import { useState } from 'react';

export default function SubmitScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState<string | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [predictionType, setPredictionType] = useState<'yes-no' | 'multiple-choice'>('yes-no');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);

  const recentShows = [
    { id: 'sherlock', name: 'Sherlock', episode: 'S4E3: The Final Problem' },
    { id: 'true-detective', name: 'True Detective', episode: 'S4E1: Night Country' },
    { id: 'dark', name: 'Dark', episode: 'S3E8: The Paradise' },
  ];

  const quickTemplates = [
    'Will [character] survive this episode?',
    'Is [character] the real villain?',
    'Will [event] happen before the episode ends?',
    'Who will be revealed as [role]?',
  ];

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Submit Prediction',
        }}
      />
      <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
        <View className="px-4 py-6 pb-24">
          {/* Quick Submit Banner */}
          <View className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-6">
            <View className="flex-row items-center gap-2 mb-2">
              <Zap size={20} color="#a855f7" />
              <Text className="font-semibold text-foreground">Quick Submit</Text>
            </View>
            <Text className="text-sm text-muted-foreground mb-3">
              Create predictions for upcoming episodes and earn points!
            </Text>
            <Button size="sm" className="bg-primary">
              <Text className="text-primary-foreground text-sm">Start Predicting</Text>
            </Button>
          </View>

          {/* Step 1: Select Show */}
          <View className="mb-8">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Step 1: Select Show & Episode
            </Text>

            {/* Search */}
            <View className="flex-row items-center bg-card border border-border rounded-xl px-4 mb-4">
              <Search size={20} color="#888" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search for a show..."
                placeholderTextColor="#888"
                className="flex-1 py-3 px-3 text-foreground"
              />
            </View>

            {/* Recent Shows */}
            <Text className="text-sm text-muted-foreground mb-2">Recent</Text>
            <View className="gap-2">
              {recentShows.map((show) => (
                <TouchableOpacity
                  key={show.id}
                  onPress={() => {
                    setSelectedShow(show.id);
                    setSelectedEpisode(show.episode);
                  }}
                >
                  <View
                    className={`bg-card border rounded-xl p-4 ${
                      selectedShow === show.id ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="font-medium text-foreground">{show.name}</Text>
                        <Text className="text-sm text-muted-foreground">{show.episode}</Text>
                      </View>
                      <ChevronRight size={20} color="#888" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Step 2: Prediction Type */}
          <View className="mb-8">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Step 2: Prediction Type
            </Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setPredictionType('yes-no')}
                className="flex-1"
              >
                <View
                  className={`p-4 rounded-xl border ${
                    predictionType === 'yes-no' ? 'bg-primary/10 border-primary' : 'bg-card border-border'
                  }`}
                >
                  <Text className="text-center font-medium text-foreground">Yes/No</Text>
                  <Text className="text-center text-xs text-muted-foreground mt-1">
                    Simple binary choice
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPredictionType('multiple-choice')}
                className="flex-1"
              >
                <View
                  className={`p-4 rounded-xl border ${
                    predictionType === 'multiple-choice' ? 'bg-primary/10 border-primary' : 'bg-card border-border'
                  }`}
                >
                  <Text className="text-center font-medium text-foreground">Multiple Choice</Text>
                  <Text className="text-center text-xs text-muted-foreground mt-1">
                    Up to 4 options
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Step 3: Question */}
          <View className="mb-8">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Step 3: Your Question
            </Text>

            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="What do you want to predict?"
              placeholderTextColor="#888"
              multiline
              numberOfLines={3}
              className="bg-card border border-border rounded-xl p-4 text-foreground mb-4"
              textAlignVertical="top"
            />

            {/* Quick Templates */}
            <Text className="text-sm text-muted-foreground mb-2">Quick Templates</Text>
            <View className="flex-row flex-wrap gap-2">
              {quickTemplates.map((template, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setQuestion(template)}
                >
                  <View className="bg-card border border-border rounded-lg px-3 py-2">
                    <Text className="text-xs text-foreground">{template}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Step 4: Options (for multiple choice) */}
          {predictionType === 'multiple-choice' && (
            <View className="mb-8">
              <Text className="text-lg font-semibold text-foreground mb-4">
                Step 4: Answer Options
              </Text>

              {options.map((option, index) => (
                <View key={index} className="mb-3">
                  <TextInput
                    value={option}
                    onChangeText={(value) => handleOptionChange(index, value)}
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor="#888"
                    className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
                  />
                </View>
              ))}
            </View>
          )}

          {/* Deadline */}
          <View className="mb-8">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Prediction Deadline
            </Text>

            <View className="bg-card border border-border rounded-xl p-4">
              <View className="flex-row items-center gap-2">
                <Clock size={20} color="#888" />
                <View>
                  <Text className="text-foreground">Auto-close before episode airs</Text>
                  <Text className="text-sm text-muted-foreground">
                    Predictions will close 30 minutes before airtime
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <Button className="w-full bg-primary mb-4">
            <Text className="text-primary-foreground font-semibold">Submit Prediction</Text>
          </Button>

          <Text className="text-xs text-center text-muted-foreground">
            By submitting, you agree to our community guidelines
          </Text>
        </View>
      </ScrollView>
    </>
  );
}