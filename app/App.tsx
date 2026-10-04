import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { type ComponentType } from 'react';
import { ActivityIndicator, StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoldButton, Header, OvykTabBar, Screen } from './src/components/ui';
import { DriverScreen } from './src/screens/DriverScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { AccountScreen, ConciergeScreen, MyStayScreen, NotificationsScreen, SosScreen, TrackingScreen } from './src/screens/StayScreens';
import { ConfirmationScreen, PaymentScreen, ReviewScreen, VehicleDetailScreen, VehiclesScreen } from './src/screens/VehicleScreens';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { AppStateProvider, useApp } from './src/state';
import { colors, serif } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Plan" component={PlanScreen} />
      <Stack.Screen name="Vehicles" component={VehiclesScreen} />
      <Stack.Screen name="Vehicle" component={VehicleDetailScreen as ComponentType<any>} />
      <Stack.Screen name="Review" component={ReviewScreen as ComponentType<any>} />
      <Stack.Screen name="Payment" component={PaymentScreen as ComponentType<any>} />
      <Stack.Screen name="Confirmation" component={ConfirmationScreen as ComponentType<any>} />
    </Stack.Navigator>
  );
}

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <OvykTabBar state={props.state} navigation={props.navigation} />}>
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Stay" component={MyStayScreen} />
      <Tab.Screen name="Concierge" component={ConciergeScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

function StaffHome() {
  const { user, signOut } = useApp();
  return (
    <Screen>
      <Header title={user?.name || 'OVYK'} />
      <View style={{ flex: 1, backgroundColor: colors.ivory, padding: 22 }}>
        <Text style={{ color: colors.ink, fontSize: 28, fontFamily: serif, marginBottom: 10 }}>Operations</Text>
        <Text style={{ color: colors.secondary, lineHeight: 22, marginBottom: 18 }}>
          Dispatch, finance, fleet and partner tools are on the local dashboard at http://localhost:3000/ops.html. Nominee tracking is at http://localhost:3000/track.html.
        </Text>
        <GoldButton label="Sign out" onPress={signOut} />
      </View>
    </Screen>
  );
}

function Root() {
  const { ready, user } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.champagne} />
      </View>
    );
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
        </>
      ) : user.role === 'DRIVER' ? (
        <Stack.Screen name="DriverHome" component={DriverScreen} />
      ) : user.role !== 'CUSTOMER' ? (
        <Stack.Screen name="StaffHome" component={StaffHome} />
      ) : (
        <>
          <Stack.Screen name="Main" component={Tabs} />
          <Stack.Screen name="Sos" component={SosScreen} />
          <Stack.Screen name="Tracking" component={TrackingScreen as ComponentType<any>} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <AppStateProvider>
          <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.black } }}>
            <Root />
          </NavigationContainer>
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
