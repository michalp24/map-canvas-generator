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
    fontFamily: "Helvetica",
    color: "#111111",
    backgroundColor: "#ffffff",
  },

  spread: {
    flexDirection: "row",
    width: "100%",
    height: "100%",
  },

  half: {
    width: 396,
    paddingTop: 46,
    paddingRight: 39,
    paddingBottom: 33,
    paddingLeft: 40,
  },

  title: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.12,
    marginBottom: 21,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 26,
  },

  field: {
    flexDirection: "row",
    alignItems: "flex-end",
  },

  fieldLabel: {
    fontSize: 8.5,
    lineHeight: 1,
    marginRight: 8,
  },

  groupLine: {
    width: 127,
    borderBottomWidth: 0.5,
    borderBottomColor: "#8c8c8c",
    marginBottom: 1,
  },

  dateLine: {
    width: 72,
    borderBottomWidth: 0.5,
    borderBottomColor: "#8c8c8c",
    marginBottom: 1,
  },

  map: {
    width: 317,
    height: 418,
    marginBottom: 22,
  },

  emptyMap: {
    width: 317,
    height: 418,
    backgroundColor: "#d9d9d9",
    marginBottom: 22,
  },

  footer: {
    fontSize: 8.5,
    lineHeight: 1,
    color: "#9a9a9a",
  },

  visitationTitle: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.12,
    marginBottom: 8,
  },

  visitationSubtitle: {
    fontSize: 8.8,
    lineHeight: 1.2,
    marginBottom: 43,
  },

  visitCard: {
    marginBottom: 44,
  },

  personRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
  },

  nameLine: {
    width: 101,
    borderBottomWidth: 0.5,
    borderBottomColor: "#8c8c8c",
    marginRight: 9,
    marginBottom: 1,
  },

  phoneLine: {
    width: 101,
    borderBottomWidth: 0.5,
    borderBottomColor: "#8c8c8c",
    marginBottom: 1,
  },

  addressRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 19,
  },

  addressLine: {
    width: 265,
    borderBottomWidth: 0.5,
    borderBottomColor: "#8c8c8c",
    marginBottom: 1,
  },

  checkRow: {
    flexDirection: "row",
    marginBottom: 13,
  },

  checkOption: {
    flexDirection: "row",
    alignItems: "center",
    width: 108,
  },

  box: {
    width: 15,
    height: 15,
    borderWidth: 0.5,
    borderColor: "#b9b9b9",
    marginRight: 10,
  },

  optionText: {
    fontSize: 8.5,
    lineHeight: 1,
  },
});

function Footer() {
  return (
    <Text style={styles.footer}>
      Harvest Baptist Church | Pastor Win Pechardo | 650.296.0922
    </Text>
  );
}

function MapHalf({ map }) {
  return (
    <View style={styles.half}>
      <Text style={styles.title}>HBC Soul Winning Map</Text>

      <View style={styles.topRow}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Group Name:</Text>
          <View style={styles.groupLine} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Date:</Text>
          <View style={styles.dateLine} />
        </View>
      </View>

      {map ? (
        <Image src={map} style={styles.map} />
      ) : (
        <View style={styles.emptyMap} />
      )}

      <Footer />
    </View>
  );
}

function LabeledLine({ label, lineStyle }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={lineStyle} />
    </View>
  );
}

function CheckOption({ children }) {
  return (
    <View style={styles.checkOption}>
      <View style={styles.box} />
      <Text style={styles.optionText}>{children}</Text>
    </View>
  );
}

function VisitEntry() {
  return (
    <View style={styles.visitCard}>
      <View style={styles.personRow}>
        <LabeledLine label="Name:" lineStyle={styles.nameLine} />
        <LabeledLine label="Phone:" lineStyle={styles.phoneLine} />
      </View>

      <View style={styles.addressRow}>
        <LabeledLine label="Address:" lineStyle={styles.addressLine} />
      </View>

      <View style={styles.checkRow}>
        <CheckOption>Made Contact</CheckOption>
        <CheckOption>Left a Note</CheckOption>
        <CheckOption>Need Follow Up</CheckOption>
      </View>

      <View style={styles.checkRow}>
        <CheckOption>Interested</CheckOption>
        <CheckOption>Not Interested</CheckOption>
        <CheckOption>Visitor Moved</CheckOption>
      </View>
    </View>
  );
}

function VisitationHalf() {
  return (
    <View style={styles.half}>
      <Text style={styles.visitationTitle}>HBC Visitation List</Text>
      <Text style={styles.visitationSubtitle}>
        Please submit this form to the church office upon completion.
      </Text>

      <VisitEntry />
      <VisitEntry />
      <VisitEntry />

      <Footer />
    </View>
  );
}

export default function MapPDF({ maps }) {
  const pages = [];

  for (let i = 0; i < maps.length; i += 2) {
    pages.push([maps[i], maps[i + 1]]);
  }

  return (
    <Document>
      {pages.flatMap((pair, i) => [
        <Page
          key={`map-${i}`}
          size="LETTER"
          orientation="landscape"
          style={styles.page}
        >
          <View style={styles.spread}>
            <MapHalf map={pair[0]} />
            <MapHalf map={pair[1]} />
          </View>
        </Page>,

        <Page
          key={`visitation-${i}`}
          size="LETTER"
          orientation="landscape"
          style={styles.page}
        >
          <View style={styles.spread}>
            <VisitationHalf />
            <VisitationHalf />
          </View>
        </Page>,
      ])}
    </Document>
  );
}
