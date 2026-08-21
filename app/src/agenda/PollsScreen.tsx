import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart3, Plus } from 'lucide-react-native';
import { tallyPoll } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { agendaGet, agendaPost, type AgendaPoll } from './agendaApi';

/**
 * Encuestas (diseño «New Poll», pestaña Encuestas).
 *
 * Los resultados se ven SIEMPRE, no solo después de votar: en un chat familiar
 * esconderlos hasta emitir el voto obliga a votar para poder mirar, que es lo
 * contrario de lo que una encuesta quiere.
 */
export function PollsScreen({
  credential,
  onCreate,
}: {
  credential: Credential;
  onCreate: () => void;
}) {
  const [polls, setPolls] = useState<AgendaPoll[] | null>(null);

  const load = useCallback(async () => {
    const result = await agendaGet<{ polls: AgendaPoll[] }>('/polls', credential.jwt);
    setPolls(result.ok ? result.data.polls : []);
  }, [credential.jwt]);

  useEffect(() => {
    void load();
  }, [load]);

  const vote = async (pollId: string, optionIndex: number) => {
    await agendaPost(`/polls/${pollId}/vote`, credential.jwt, { optionIndex });
    void load();
  };

  return (
    <View className="flex-1 bg-background" testID="pantalla-encuestas">
      {polls === null ? (
        <View className="px-4 pt-4" testID="encuestas-cargando">
          {[0, 1].map((index) => (
            <View key={index} className="mb-3 h-32 rounded-xl bg-surface-variant" />
          ))}
        </View>
      ) : polls.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8" testID="encuestas-vacio">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <BarChart3 size={28} color="#6b38d4" />
          </View>
          <Text className="mt-4 text-lg font-semibold text-on-surface">Sin encuestas</Text>
          <Text className="mt-1 text-center text-sm leading-5 text-on-surface-variant">
            Pregúntale algo al grupo y deja que decidan.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {polls.map((poll) => {
            const tally = tallyPoll(
              {
                question: poll.question,
                options: poll.options,
                allowMultiple: poll.allowMultiple,
                anonymous: poll.anonymous,
                closedAt: poll.closedAt ? new Date(poll.closedAt) : null,
              },
              credential.userId
            );
            return (
              <View
                key={poll.id}
                testID={`encuesta-${poll.id}`}
                className="mb-3 rounded-xl border border-outline/10 bg-surface p-4"
              >
                <Text className="text-base font-bold text-on-surface">{poll.question}</Text>
                {poll.allowMultiple || poll.anonymous ? (
                  <Text className="mt-0.5 text-[11px] text-on-surface-variant">
                    {[
                      poll.allowMultiple ? 'Varias respuestas' : null,
                      poll.anonymous ? 'Resultados anónimos' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}

                <View className="mt-3">
                  {tally.map((option) => (
                    <Pressable
                      key={option.optionIndex}
                      testID={`opcion-${poll.id}-${option.optionIndex}`}
                      onPress={() => void vote(poll.id, option.optionIndex)}
                      className="mb-2 overflow-hidden rounded-lg border border-outline/15"
                    >
                      {/* La barra vive DETRÁS del texto, no al lado: así el
                          porcentaje se lee sobre su propia proporción. */}
                      <View
                        className={`absolute bottom-0 left-0 top-0 ${
                          option.votedByMe ? 'bg-primary/25' : 'bg-surface-variant'
                        }`}
                        style={{ width: `${option.percent}%` }}
                      />
                      <View className="min-h-[44px] flex-row items-center justify-between px-3 py-2">
                        <Text
                          className={`min-w-0 flex-1 text-sm ${
                            option.votedByMe ? 'font-semibold text-primary' : 'text-on-surface'
                          }`}
                          numberOfLines={1}
                        >
                          {option.text}
                        </Text>
                        <Text className="ml-2 shrink-0 text-[11px] font-semibold text-on-surface-variant">
                          {option.percent}% · {option.count}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Pressable
        testID="btn-nueva-encuesta"
        onPress={onCreate}
        className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <Plus size={24} color="#ffffff" />
      </Pressable>
    </View>
  );
}
