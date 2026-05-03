"use client";

import {
  Page,
  Text,
  View,
  Document,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: "Helvetica",
  },

  container: {
    flexDirection: "row",
    height: "100%",
  },

  half: {
  width: "50%",
  padding: 10,
  borderRight: "1px dashed #999",
},

  halfRight: {
    width: "50%",
    padding: 10,
  },

  title: {
  fontSize: 14,
  marginBottom: 10,
},

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    marginBottom: 8,
  },

  map: {
  width: "100%",
  height: 450,
  border: "1px solid #ccc",
  marginBottom: 8,
},

  footer: {
    fontSize: 8,
    textAlign: "center",
    marginTop: 6,
    color: "#555",
  },
});

export default function MapPDF({ maps }) {
  const pages = [];

  // pair maps (2 per page → left + right)
  for (let i = 0; i < maps.length; i += 2) {
    pages.push([maps[i], maps[i + 1]]);
  }

  return (
    <Document>
      {pages.map((pair, i) => (
        <Page key={i} size="LETTER" orientation="landscape" style={styles.page}>
          <View style={styles.container}>
            
            {/* LEFT HALF */}
            <View style={styles.half}>
              <Text style={styles.title}>HBC Soul Winning Map</Text>

              <View style={styles.topRow}>
                <Text>Group Name: _____________________ </Text>
                <Text>Date: __________</Text>
              </View>

              <Image src={pair[0]} style={styles.map} />

              <Text style={styles.footer}>
                Harvest Baptist Church | Pastor Win Pechardo | 650.296.0922
              </Text>
            </View>

            {/* RIGHT HALF */}
            <View style={styles.halfRight}>
              <Text style={styles.title}>HBC Soul Winning Map</Text>

              <View style={styles.topRow}>
                <Text>Group Name: _____________________</Text>
                <Text>Date: __________</Text>
              </View>

              {pair[1] ? (
                <Image src={pair[1]} style={styles.map} />
              ) : (
                <View style={styles.map} />
              )}

              <Text style={styles.footer}>
                Harvest Baptist Church | Pastor Win Pechardo | 650.296.0922
              </Text>
            </View>

          </View>
        </Page>
      ))}
    </Document>
  );
}